import { getDb, limparTodos } from "@/lib/db";
import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";

/** GET /api/admin/profissionais?incluir_inativos=1 */
export async function GET(req: Request): Promise<Response> {
  try {
    await exigirSessao();
    const db = getDb();
    const url = new URL(req.url);
    const incluirInativos = url.searchParams.get("incluir_inativos") === "1";
    const sql = incluirInativos
      ? "SELECT * FROM profissionais ORDER BY situacao = 'ativo' DESC, nome_completo"
      : "SELECT * FROM profissionais WHERE situacao = 'ativo' ORDER BY nome_completo";
    const linhas = limparTodos<Record<string, unknown>>(db.prepare(sql).all() as never[]);
    return ok({
      profissionais: linhas.map((p) => ({
        id: Number(p.id),
        nome: String(p.nome_completo),
        profissao: String(p.profissao),
        telefone: String(p.telefone),
        email: p.email === null ? null : String(p.email),
        situacao: String(p.situacao),
        observacoes: p.observacoes === null ? null : String(p.observacoes),
        created_at: String(p.created_at),
        updated_at: String(p.updated_at),
      })),
    });
  } catch (e) {
    return tratarErro(e);
  }
}

/** POST /api/admin/profissionais — cadastro (RF-028) */
export async function POST(req: Request): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const b = await lerCorpo<{
      nome?: string;
      profissao?: string;
      telefone?: string;
      email?: string;
      observacoes?: string;
    }>(req);
    const nome = (b.nome || "").trim();
    if (nome.length < 3) return erro(400, "Nome completo é obrigatório (mínimo 3 caracteres).");

    const db = getDb();
    const r = db
      .prepare(
        `INSERT INTO profissionais (nome_completo, profissao, telefone, email, observacoes)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        nome,
        (b.profissao || "").trim(),
        (b.telefone || "").trim(),
        (b.email || "").trim() || null,
        (b.observacoes || "").trim() || null
      );
    const id = Number(r.lastInsertRowid);
    registrarAuditoria(sessao.adminId, "criar", "profissional", id, `Cadastrou o profissional ${nome}.`);
    return ok({ ok: true, id }, { status: 201 });
  } catch (e) {
    return tratarErro(e);
  }
}
