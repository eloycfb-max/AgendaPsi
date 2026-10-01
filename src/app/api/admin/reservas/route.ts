import { getDb, transacao } from "@/lib/db";
import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { ConflitoError, haConflito, validarGrade } from "@/lib/schedule";
import { hojeIso, paraCentavos } from "@/lib/dates";

/**
 * POST /api/admin/reservas — cria reserva avulsa ou reposição (RF-022/RF-024).
 * Executa em transação com BEGIN IMMEDIATE: se duas confirmações simultâneas
 * disputarem o mesmo horário, apenas uma é aceita (CA-006 / RNF-003).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const b = await lerCorpo<{
      consultorio_id?: number;
      profissional_id?: number;
      tipo?: string;
      data?: string;
      inicio?: number;
      observacoes?: string;
      valor?: string | number;
      vencimento?: string;
      criar_lancamento?: boolean;
    }>(req);

    const consultorioId = Number(b.consultorio_id);
    const profissionalId = Number(b.profissional_id);
    const tipo = b.tipo || "avulsa";
    const data = b.data || "";
    const inicio = Number(b.inicio);

    if (!["avulsa", "reposicao"].includes(tipo)) return erro(400, "Tipo deve ser avulsa ou reposicao.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return erro(400, "Data inválida.");
    const problema = validarGrade(data, inicio, inicio + 1);
    if (problema) return erro(400, problema);
    if (data < hojeIso()) return erro(400, "Não é possível criar reservas no passado.");

    const db = getDb();
    const sala = db.prepare("SELECT id FROM consultorios WHERE id = ? AND situacao = 'ativo'").get(consultorioId);
    if (!sala) return erro(400, "Consultório inválido.");
    const prof = db
      .prepare("SELECT situacao, nome_completo FROM profissionais WHERE id = ?")
      .get(profissionalId) as { situacao: string; nome_completo: string } | undefined;
    if (!prof) return erro(400, "Profissional inválido.");
    if (prof.situacao !== "ativo") return erro(400, "Profissional inativo não pode receber novas reservas (RF-030).");

    let valorAcordado: number | null = null;
    if (b.valor !== undefined && b.valor !== "" && b.valor !== null) {
      try {
        valorAcordado = paraCentavos(b.valor as string);
      } catch {
        return erro(400, "Valor acordado inválido.");
      }
      if (valorAcordado < 0) return erro(400, "Valor não pode ser negativo.");
    }

    const resultado = transacao(() => {
      if (haConflito(consultorioId, data, inicio)) {
        throw new ConflitoError("Este horário já está ocupado por outra reserva. Escolha outro horário (RF-039).");
      }
      const r = db
        .prepare(
          `INSERT INTO reservas (consultorio_id, profissional_id, tipo, data, inicio, fim, valor_acordado, observacoes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(consultorioId, profissionalId, tipo, data, inicio, inicio + 1, valorAcordado, (b.observacoes || "").trim() || null);
      const reservaId = Number(r.lastInsertRowid);

      // Lançamento financeiro associado quando há valor acordado (RF-046)
      let lancamentoId: number | null = null;
      if (valorAcordado && valorAcordado > 0 && b.criar_lancamento !== false) {
        const lr = db
          .prepare(
            `INSERT INTO lancamentos (profissional_id, reserva_id, consultorio_id, data_referencia, valor_cobrado, vencimento)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(profissionalId, reservaId, consultorioId, data, valorAcordado, b.vencimento || data);
        lancamentoId = Number(lr.lastInsertRowid);
      }
      return { reservaId, lancamentoId };
    });

    registrarAuditoria(
      sessao.adminId,
      "criar",
      "reserva",
      resultado.reservaId,
      `Reserva ${tipo} em ${data} às ${String(inicio).padStart(2, "0")}h (${prof.nome_completo}).`
    );
    return ok({ ok: true, id: resultado.reservaId, lancamento_id: resultado.lancamentoId }, { status: 201 });
  } catch (e) {
    return tratarErro(e);
  }
}
