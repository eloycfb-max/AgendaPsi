import { getDb, transacao } from "@/lib/db";
import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { validarConflitoRecorrencia, validarGrade } from "@/lib/schedule";
import { addMeses, diaSemana, paraCentavos } from "@/lib/dates";
import { DIAS_SEMANA } from "@/lib/constants";

/**
 * POST /api/admin/recorrencias — cria horário fixo semanal (RF-017 a RF-019).
 * Valida TODAS as ocorrências da vigência contra reservas pontuais e
 * outras recorrências antes de gravar (PRD 5.3).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const b = await lerCorpo<{
      consultorio_id?: number;
      profissional_id?: number;
      dia_semana?: number;
      inicio?: number;
      data_inicio?: string;
      data_fim?: string;
      observacoes?: string;
      valor?: string | number;
    }>(req);

    const consultorioId = Number(b.consultorio_id);
    const profissionalId = Number(b.profissional_id);
    const dia = Number(b.dia_semana);
    const inicio = Number(b.inicio);
    const dataInicio = b.data_inicio || "";

    if (!DIAS_SEMANA.some((d) => d.numero === dia)) return erro(400, "Dia da semana inválido (seg a sáb).");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) return erro(400, "Data inicial inválida.");
    if (b.data_fim && !/^\d{4}-\d{2}-\d{2}$/.test(b.data_fim)) return erro(400, "Data final inválida.");
    if (b.data_fim && b.data_fim < dataInicio) return erro(400, "Data final anterior à data inicial.");

    // Confere se o dia da semana escolhido bate com a data inicial
    if (diaSemana(dataInicio) !== dia) {
      return erro(400, `A data inicial não cai em ${DIAS_SEMANA.find((d) => d.numero === dia)?.longo}.`);
    }
    const problema = validarGrade(dataInicio, inicio, inicio + 1);
    if (problema) return erro(400, problema);

    const db = getDb();
    const sala = db.prepare("SELECT id FROM consultorios WHERE id = ? AND situacao = 'ativo'").get(consultorioId);
    if (!sala) return erro(400, "Consultório inválido.");
    const prof = db.prepare("SELECT situacao FROM profissionais WHERE id = ?").get(profissionalId) as
      | { situacao: string }
      | undefined;
    if (!prof) return erro(400, "Profissional inválido.");
    if (prof.situacao !== "ativo") return erro(400, "Profissional inativo não pode receber novas reservas (RF-030).");

    let valorAcordado: number | null = null;
    if (b.valor !== undefined && b.valor !== "") {
      try {
        valorAcordado = paraCentavos(b.valor as string);
      } catch {
        return erro(400, "Valor inválido.");
      }
    }

    const limite = b.data_fim || addMeses(dataInicio, 120); // valida até 10 anos sem data final
    const conflito = validarConflitoRecorrencia(
      { consultorio_id: consultorioId, dia_semana: dia, inicio, data_inicio: dataInicio, data_fim: b.data_fim || null },
      limite
    );
    if (conflito.conflito) {
      return erro(409, `Conflito na vigência: ${conflito.data} às ${String(inicio).padStart(2, "0")}h já está ocupado.`, {
        conflito: true,
        data: conflito.data,
      });
    }

    const id = transacao(() => {
      const r = db
        .prepare(
          `INSERT INTO recorrencias (consultorio_id, profissional_id, dia_semana, inicio, fim, data_inicio, data_fim, valor_acordado, observacoes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(consultorioId, profissionalId, dia, inicio, inicio + 1, dataInicio, b.data_fim || null, valorAcordado, (b.observacoes || "").trim() || null);
      return Number(r.lastInsertRowid);
    });

    const rotuloDia = DIAS_SEMANA.find((d) => d.numero === dia)?.longo;
    registrarAuditoria(
      sessao.adminId,
      "criar",
      "recorrencia",
      id,
      `Horário fixo: ${rotuloDia} às ${String(inicio).padStart(2, "0")}h, vigência a partir de ${dataInicio}.`
    );
    return ok({ ok: true, id }, { status: 201 });
  } catch (e) {
    return tratarErro(e);
  }
}
