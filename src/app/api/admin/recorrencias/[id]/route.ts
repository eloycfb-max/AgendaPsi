import { getDb, transacao } from "@/lib/db";
import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { validarConflitoRecorrencia, validarGrade } from "@/lib/schedule";
import { addMeses, diaSemana, paraCentavos } from "@/lib/dates";
import { DIAS_SEMANA } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

/** PUT /api/admin/recorrencias/[id] — edita vigência/dia/horário revalidando conflitos */
export async function PUT(req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const db = getDb();
    const atual = db.prepare("SELECT * FROM recorrencias WHERE id = ?").get(Number(id));
    if (!atual) return erro(404, "Recorrência não encontrada.");
    const row = atual as unknown as Record<string, unknown>;

    const b = await lerCorpo<{
      dia_semana?: number;
      inicio?: number;
      data_inicio?: string;
      data_fim?: string;
      profissional_id?: number;
      valor?: string | number;
      observacoes?: string;
      situacao?: string;
    }>(req);

    const dia = Number(b.dia_semana ?? row.dia_semana);
    const inicio = Number(b.inicio ?? row.inicio);
    const dataInicio = b.data_inicio ?? String(row.data_inicio);
    const dataFim = b.data_fim !== undefined ? b.data_fim || null : row.data_fim === null ? null : String(row.data_fim);
    const profissionalId = Number(b.profissional_id ?? row.profissional_id);

    if (!DIAS_SEMANA.some((d) => d.numero === dia)) return erro(400, "Dia da semana inválido.");
    if (diaSemana(dataInicio) !== dia) {
      return erro(400, `A data inicial não cai em ${DIAS_SEMANA.find((d) => d.numero === dia)?.longo}.`);
    }
    const problema = validarGrade(dataInicio, inicio, inicio + 1);
    if (problema) return erro(400, problema);
    if (dataFim && dataFim < dataInicio) return erro(400, "Data final anterior à data inicial.");

    const prof = db.prepare("SELECT situacao FROM profissionais WHERE id = ?").get(profissionalId) as
      | { situacao: string }
      | undefined;
    if (!prof) return erro(400, "Profissional inválido.");
    if (prof.situacao !== "ativo") return erro(400, "Profissional inativo não pode receber reservas (RF-030).");

    let valorAcordado = row.valor_acordado === null ? null : Number(row.valor_acordado);
    if (b.valor !== undefined && b.valor !== "") {
      try {
        valorAcordado = paraCentavos(b.valor as string);
      } catch {
        return erro(400, "Valor inválido.");
      }
    }

    const situacao = b.situacao ?? String(row.situacao);
    if (!["ativa", "encerrada"].includes(situacao)) return erro(400, "Situação inválida.");

    const limite = dataFim || addMeses(dataInicio, 120);
    const conflito = validarConflitoRecorrencia(
      { id: Number(id), consultorio_id: Number(row.consultorio_id), dia_semana: dia, inicio, data_inicio: dataInicio, data_fim: dataFim },
      limite
    );
    if (conflito.conflito) {
      return erro(409, `Conflito na vigência: ${conflito.data} às ${String(inicio).padStart(2, "0")}h já está ocupado.`, {
        conflito: true,
        data: conflito.data,
      });
    }

    transacao(() => {
      db.prepare(
        `UPDATE recorrencias SET dia_semana = ?, inicio = ?, fim = ?, data_inicio = ?, data_fim = ?,
         profissional_id = ?, valor_acordado = ?, observacoes = ?, situacao = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        dia,
        inicio,
        inicio + 1,
        dataInicio,
        dataFim,
        profissionalId,
        valorAcordado,
        (b.observacoes ?? String(row.observacoes ?? "")).trim() || null,
        situacao,
        Number(id)
      );
    });

    registrarAuditoria(
      sessao.adminId,
      "editar",
      "recorrencia",
      Number(id),
      `Recorrência atualizada (${DIAS_SEMANA.find((d) => d.numero === dia)?.longo} ${String(inicio).padStart(2, "0")}h, vigência ${dataInicio}${dataFim ? " a " + dataFim : " (sem data final)"}).`
    );
    return ok({ ok: true });
  } catch (e) {
    return tratarErro(e);
  }
}

/** DELETE /api/admin/recorrencias/[id] — encerra a série (RF-020) */
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const db = getDb();
    const atual = db.prepare("SELECT * FROM recorrencias WHERE id = ?").get(Number(id));
    if (!atual) return erro(404, "Recorrência não encontrada.");
    db.prepare(
      "UPDATE recorrencias SET situacao = 'encerrada', data_fim = COALESCE(data_fim, date('now')), updated_at = datetime('now') WHERE id = ?"
    ).run(Number(id));
    registrarAuditoria(sessao.adminId, "encerrar", "recorrencia", Number(id), "Encerrou a série de horário fixo.");
    return ok({ ok: true });
  } catch (e) {
    return tratarErro(e);
  }
}
