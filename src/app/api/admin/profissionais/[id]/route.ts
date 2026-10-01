import { getDb } from "@/lib/db";
import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

/** GET /api/admin/profissionais/[id] — inclui histórico de reservas (RF-032) */
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  try {
    await exigirSessao();
    const { id } = await params;
    const db = getDb();
    const p = db.prepare("SELECT * FROM profissionais WHERE id = ?").get(Number(id));
    if (!p) return erro(404, "Profissional não encontrado.");
    const prof = { ...(p as object) } as Record<string, unknown>;

    const reservas = db
      .prepare(
        `SELECT r.id, r.data, r.inicio, r.fim, r.tipo, r.situacao, c.nome AS consultorio
         FROM reservas r JOIN consultorios c ON c.id = r.consultorio_id
         WHERE r.profissional_id = ? ORDER BY r.data DESC, r.inicio LIMIT 200`
      )
      .all(Number(id)) as never[];
    const recorrencias = db
      .prepare(
        `SELECT rc.id, rc.dia_semana, rc.inicio, rc.data_inicio, rc.data_fim, rc.situacao, c.nome AS consultorio
         FROM recorrencias rc JOIN consultorios c ON c.id = rc.consultorio_id
         WHERE rc.profissional_id = ? ORDER BY rc.id DESC`
      )
      .all(Number(id)) as never[];

    return ok({
      profissional: {
        id: Number(prof.id),
        nome: String(prof.nome_completo),
        profissao: String(prof.profissao),
        telefone: String(prof.telefone),
        email: prof.email === null ? null : String(prof.email),
        situacao: String(prof.situacao),
        observacoes: prof.observacoes === null ? null : String(prof.observacoes),
        created_at: String(prof.created_at),
        updated_at: String(prof.updated_at),
      },
      reservas: reservas.map((r) => ({ ...(r as object) })),
      recorrencias: recorrencias.map((r) => ({ ...(r as object) })),
    });
  } catch (e) {
    return tratarErro(e);
  }
}

/** PUT /api/admin/profissionais/[id] — edição (RF-029) */
export async function PUT(req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const db = getDb();
    const atual = db.prepare("SELECT * FROM profissionais WHERE id = ?").get(Number(id));
    if (!atual) return erro(404, "Profissional não encontrado.");

    const b = await lerCorpo<{
      nome?: string;
      profissao?: string;
      telefone?: string;
      email?: string;
      situacao?: string;
      observacoes?: string;
    }>(req);
    const atualRow = atual as unknown as Record<string, unknown>;
    const nome = (b.nome ?? String(atualRow.nome_completo)).trim();
    if (nome.length < 3) return erro(400, "Nome completo é obrigatório.");
    if (b.situacao && !["ativo", "inativo"].includes(b.situacao)) return erro(400, "Situação inválida.");

    // Campos omitidos no body preservam o valor atual (merge, não overwrite).
    const escolher = (novo: string | undefined | null, atualValor: unknown) =>
      novo !== undefined && novo !== null ? novo.trim() || null : atualValor === null ? null : String(atualValor);

    db.prepare(
      `UPDATE profissionais SET nome_completo = ?, profissao = ?, telefone = ?, email = ?,
       situacao = ?, observacoes = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(
      nome,
      escolher(b.profissao, atualRow.profissao) ?? "",
      escolher(b.telefone, atualRow.telefone) ?? "",
      escolher(b.email, atualRow.email),
      b.situacao ?? String(atualRow.situacao),
      escolher(b.observacoes, atualRow.observacoes),
      Number(id)
    );
    registrarAuditoria(
      sessao.adminId,
      "editar",
      "profissional",
      Number(id),
      `Atualizou o cadastro de ${nome}${b.situacao === "inativo" ? " (inativado)" : ""}.`
    );
    return ok({ ok: true });
  } catch (e) {
    return tratarErro(e);
  }
}

/** DELETE /api/admin/profissionais/[id] — bloqueia exclusão com vínculos (RF-031) */
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const db = getDb();
    const atual = db.prepare("SELECT * FROM profissionais WHERE id = ?").get(Number(id));
    if (!atual) return erro(404, "Profissional não encontrado.");

    const vinculos = db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM reservas WHERE profissional_id = ?) AS reservas,
          (SELECT COUNT(*) FROM recorrencias WHERE profissional_id = ?) AS recorrencias,
          (SELECT COUNT(*) FROM lancamentos WHERE profissional_id = ?) AS lancamentos`
      )
      .get(Number(id), Number(id), Number(id)) as { reservas: number; recorrencias: number; lancamentos: number };

    if (vinculos.reservas + vinculos.recorrencias + vinculos.lancamentos > 0) {
      return erro(
        409,
        "Profissional possui reservas ou registros financeiros. Inative-o em vez de excluir (RF-031).",
        { bloqueado: true }
      );
    }
    db.prepare("DELETE FROM profissionais WHERE id = ?").run(Number(id));
    registrarAuditoria(sessao.adminId, "excluir", "profissional", Number(id), "Excluiu profissional sem vínculos.");
    return ok({ ok: true });
  } catch (e) {
    return tratarErro(e);
  }
}
