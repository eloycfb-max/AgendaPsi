import { getDb } from "@/lib/db";
import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/solicitacoes/[id]/recusar — marca como recusada */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const db = getDb();
    const sol = db.prepare("SELECT * FROM solicitacoes WHERE id = ?").get(Number(id)) as
      | Record<string, unknown>
      | undefined;
    if (!sol) return erro(404, "Solicitação não encontrada.");
    const row = sol as unknown as Record<string, unknown>;
    if (String(row.situacao) !== "pendente") return erro(409, "Esta solicitação já foi tratada.");

    const b = await lerCorpo<{ motivo?: string }>(req).catch(() => ({ motivo: "" }));
    db.prepare(
      "UPDATE solicitacoes SET situacao = 'recusada', observacoes = ?, updated_at = datetime('now') WHERE id = ?"
    ).run((b.motivo || String(row.observacoes || "")).trim() || null, Number(id));
    registrarAuditoria(sessao.adminId, "recusar", "solicitacao", Number(id), `Solicitação de ${row.nome} recusada.`);
    return ok({ ok: true });
  } catch (e) {
    return tratarErro(e);
  }
}
