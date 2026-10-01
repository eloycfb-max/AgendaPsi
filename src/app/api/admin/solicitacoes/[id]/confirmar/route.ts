import { getDb, transacao } from "@/lib/db";
import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { ConflitoError, haConflito, validarConflitoRecorrencia, validarGrade } from "@/lib/schedule";
import { diaSemana, hojeIso, paraCentavos, addMeses } from "@/lib/dates";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/solicitacoes/[id]/confirmar
 *
 * RF-038/RF-039: REVALIDA a disponibilidade no servidor antes de confirmar.
 * Se o horário já foi ocupado, retorna 409 e a solicitação permanece pendente
 * para escolha de outro horário (CA-006).
 *
 * body opcional: { profissional_id, tipo?, valor?, vencimento? }
 *  - tipo "fixo" → cria recorrência semanal a partir da data solicitada.
 *  - tipo "avulsa"/"reposicao" → cria reserva pontual.
 */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const db = getDb();

    const sol = db.prepare("SELECT * FROM solicitacoes WHERE id = ?").get(Number(id)) as
      | Record<string, unknown>
      | undefined;
    if (!sol) return erro(404, "Solicitação não encontrada.");
    const solicitacao = sol as unknown as Record<string, unknown>;
    if (String(solicitacao.situacao) !== "pendente") {
      return erro(409, "Esta solicitação já foi tratada.");
    }

    const b = await lerCorpo<{
      profissional_id?: number;
      tipo?: string;
      valor?: string | number;
      vencimento?: string;
      observacoes?: string;
    }>(req);
    const profissionalId = Number(b.profissional_id);
    const tipo = b.tipo ?? String(solicitacao.tipo);
    const data = String(solicitacao.data);
    const inicio = Number(solicitacao.inicio);
    const consultorioId = Number(solicitacao.consultorio_id);

    if (!profissionalId) return erro(400, "Selecione o profissional para confirmar.");
    const prof = db.prepare("SELECT situacao, nome_completo FROM profissionais WHERE id = ?").get(profissionalId) as
      | { situacao: string; nome_completo: string }
      | undefined;
    if (!prof) return erro(400, "Profissional inválido.");
    if (prof.situacao !== "ativo") return erro(400, "Profissional inativo não pode receber reservas (RF-030).");

    let valorAcordado: number | null = null;
    if (b.valor !== undefined && b.valor !== "") {
      try {
        valorAcordado = paraCentavos(b.valor as string);
      } catch {
        return erro(400, "Valor inválido.");
      }
    }

    const problema = validarGrade(data, inicio, inicio + 1);
    if (problema) return erro(400, problema);
    if (data < hojeIso()) return erro(400, "A data solicitada já passou.");

    const resultado = transacao(() => {
      // Revalidação de disponibilidade (RF-038)
      if (tipo === "fixo") {
        const dia = diaSemana(data);
        const conflito = validarConflitoRecorrencia(
          { consultorio_id: consultorioId, dia_semana: dia, inicio, data_inicio: data, data_fim: null },
          addMeses(data, 120)
        );
        if (conflito.conflito) {
          throw new ConflitoError(`Conflito na vigência (${conflito.data}). Escolha outro horário (RF-039).`);
        }
        const r = db
          .prepare(
            `INSERT INTO recorrencias (consultorio_id, profissional_id, dia_semana, inicio, fim, data_inicio, valor_acordado, observacoes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(consultorioId, profissionalId, dia, inicio, inicio + 1, data, valorAcordado, `Confirmado a partir da solicitação #${id}`);
        const recId = Number(r.lastInsertRowid);
        if (valorAcordado) {
          // Lançamento para a primeira ocorrência; demais podem ser lançados manualmente
          db.prepare(
            `INSERT INTO lancamentos (profissional_id, consultorio_id, data_referencia, valor_cobrado, vencimento, observacoes)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).run(profissionalId, consultorioId, data, valorAcordado, b.vencimento || data, `Recorrência #${recId}`);
        }
        return { tipo: "recorrencia" as const, id: recId };
      }

      if (haConflito(consultorioId, data, inicio)) {
        throw new ConflitoError("Este horário já foi ocupado por outra reserva. Escolha outro horário (RF-039).");
      }
      const r = db
        .prepare(
          `INSERT INTO reservas (consultorio_id, profissional_id, tipo, data, inicio, fim, valor_acordado, observacoes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(consultorioId, profissionalId, tipo === "reposicao" ? "reposicao" : "avulsa", data, inicio, inicio + 1, valorAcordado, `Confirmado a partir da solicitação #${id}`);
      const reservaId = Number(r.lastInsertRowid);
      if (valorAcordado) {
        db.prepare(
          `INSERT INTO lancamentos (profissional_id, reserva_id, consultorio_id, data_referencia, valor_cobrado, vencimento)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(profissionalId, reservaId, consultorioId, data, valorAcordado, b.vencimento || data);
      }
      db.prepare(
        "UPDATE solicitacoes SET situacao = 'confirmada', observacoes = ?, updated_at = datetime('now') WHERE id = ?"
      ).run((b.observacoes ?? String(solicitacao.observacoes ?? "")).trim() || null, Number(id));
      return { tipo: "reserva" as const, id: reservaId };
    });

    registrarAuditoria(
      sessao.adminId,
      "confirmar",
      "solicitacao",
      Number(id),
      `Solicitação de ${solicitacao.nome} confirmada (${resultado.tipo} #${resultado.id}) para ${data} às ${String(inicio).padStart(2, "0")}h.`
    );
    return ok({ ok: true, criado: resultado });
  } catch (e) {
    return tratarErro(e);
  }
}
