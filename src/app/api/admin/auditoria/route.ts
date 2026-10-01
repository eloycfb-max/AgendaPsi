import { getDb, limparTodos } from "@/lib/db";
import { ok, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { formatarDataHora } from "@/lib/dates";

/** GET /api/admin/auditoria?limite=100 — histórico de alterações (RF-045 / RNF-011) */
export async function GET(req: Request): Promise<Response> {
  try {
    await exigirSessao();
    const url = new URL(req.url);
    const limite = Math.min(Math.max(Number(url.searchParams.get("limite") || 100), 1), 500);
    const db = getDb();
    const linhas = limparTodos<Record<string, unknown>>(
      db
        .prepare(
          `SELECT a.*, adm.nome AS nome_admin FROM auditoria a
           LEFT JOIN administradores adm ON adm.id = a.admin_id
           ORDER BY a.id DESC LIMIT ?`
        )
        .all(limite) as never[]
    );
    return ok({
      eventos: linhas.map((l) => ({
        id: Number(l.id),
        admin: l.nome_admin === null ? "Sistema" : String(l.nome_admin),
        acao: String(l.acao),
        entidade: String(l.entidade),
        entidade_id: l.entidade_id === null ? null : Number(l.entidade_id),
        resumo: String(l.resumo),
        quando: formatarDataHora(String(l.created_at)),
      })),
    });
  } catch (e) {
    return tratarErro(e);
  }
}
