import { getDb } from "@/lib/db";
import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

/** PUT /api/admin/consultorios/[id] — edita informações (RF-043) */
export async function PUT(req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const db = getDb();
    const atual = db.prepare("SELECT * FROM consultorios WHERE id = ?").get(Number(id));
    if (!atual) return erro(404, "Consultório não encontrado.");

    const b = await lerCorpo<{
      nome?: string;
      descricao?: string;
      recursos?: string;
      situacao?: string;
    }>(req);
    const atualRow = atual as unknown as Record<string, unknown>;
    const nome = (b.nome ?? String(atualRow.nome)).trim();
    if (!nome) return erro(400, "Nome é obrigatório.");
    if (b.situacao && !["ativo", "inativo"].includes(b.situacao)) return erro(400, "Situação inválida.");

    db.prepare(
      `UPDATE consultorios SET nome = ?, descricao = ?, recursos = ?, situacao = ?,
       updated_at = datetime('now') WHERE id = ?`
    ).run(
      nome,
      (b.descricao ?? String(atualRow.descricao)).trim(),
      (b.recursos ?? String(atualRow.recursos)).trim(),
      b.situacao ?? String(atualRow.situacao),
      Number(id)
    );
    registrarAuditoria(sessao.adminId, "editar", "consultorio", Number(id), `Atualizou ${nome}.`);
    return ok({ ok: true });
  } catch (e) {
    return tratarErro(e);
  }
}

/** DELETE /api/admin/consultorios/[id] — bloqueia se houver reservas */
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const db = getDb();
    const vinculos = db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM reservas WHERE consultorio_id = ?) AS reservas,
                (SELECT COUNT(*) FROM recorrencias WHERE consultorio_id = ?) AS recorrencias`
      )
      .get(Number(id), Number(id)) as { reservas: number; recorrencias: number };
    if (vinculos.reservas + vinculos.recorrencias > 0) {
      return erro(409, "Consultório possui reservas. Inative-o em vez de excluir.", { bloqueado: true });
    }
    db.prepare("DELETE FROM consultorios WHERE id = ?").run(Number(id));
    registrarAuditoria(sessao.adminId, "excluir", "consultorio", Number(id), "Excluiu consultório sem reservas.");
    return ok({ ok: true });
  } catch (e) {
    return tratarErro(e);
  }
}
