import { getDb } from "@/lib/db";
import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

/** PUT /api/admin/fotos/[id] — altera alt, ordem e situação */
export async function PUT(req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const db = getDb();
    const atual = db.prepare("SELECT * FROM fotos WHERE id = ?").get(Number(id));
    if (!atual) return erro(404, "Foto não encontrada.");
    const row = atual as unknown as Record<string, unknown>;

    const b = await lerCorpo<{ alt?: string; ordem?: number; situacao?: string }>(req);
    if (b.situacao && !["ativo", "inativo"].includes(b.situacao)) return erro(400, "Situação inválida.");
    db.prepare("UPDATE fotos SET alt = ?, ordem = ?, situacao = ? WHERE id = ?").run(
      (b.alt ?? String(row.alt)).trim(),
      Number(b.ordem ?? row.ordem),
      b.situacao ?? String(row.situacao),
      Number(id)
    );
    registrarAuditoria(sessao.adminId, "editar", "foto", Number(id), "Atualizou foto do consultório.");
    return ok({ ok: true });
  } catch (e) {
    return tratarErro(e);
  }
}

/** DELETE /api/admin/fotos/[id] — remove a foto (fisicamente não apaga o arquivo) */
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const db = getDb();
    const atual = db.prepare("SELECT * FROM fotos WHERE id = ?").get(Number(id));
    if (!atual) return erro(404, "Foto não encontrada.");
    db.prepare("DELETE FROM fotos WHERE id = ?").run(Number(id));
    registrarAuditoria(sessao.adminId, "excluir", "foto", Number(id), "Removeu foto do consultório.");
    return ok({ ok: true });
  } catch (e) {
    return tratarErro(e);
  }
}
