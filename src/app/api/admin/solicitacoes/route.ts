import { getDb, limparTodos } from "@/lib/db";
import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { validarGrade } from "@/lib/schedule";
import { hojeIso } from "@/lib/dates";

/** GET /api/admin/solicitacoes?situacao=pendente — lista solicitações (RF-037) */
export async function GET(req: Request): Promise<Response> {
  try {
    await exigirSessao();
    const url = new URL(req.url);
    const situacao = url.searchParams.get("situacao");
    const db = getDb();
    let sql = `SELECT s.*, c.nome AS nome_consultorio FROM solicitacoes s
               JOIN consultorios c ON c.id = s.consultorio_id`;
    const params: unknown[] = [];
    if (situacao && situacao !== "todas") {
      sql += " WHERE s.situacao = ?";
      params.push(situacao);
    }
    sql += " ORDER BY s.situacao = 'pendente' DESC, s.created_at DESC LIMIT 300";
    const linhas = limparTodos<Record<string, unknown>>(db.prepare(sql).all(...(params as never[])) as never[]);
    return ok({
      solicitacoes: linhas.map((s) => ({
        id: Number(s.id),
        nome: String(s.nome),
        telefone: String(s.telefone),
        consultorio_id: Number(s.consultorio_id),
        nome_consultorio: String(s.nome_consultorio),
        data: String(s.data),
        inicio: Number(s.inicio),
        fim: Number(s.fim),
        tipo: String(s.tipo),
        situacao: String(s.situacao),
        observacoes: s.observacoes === null ? null : String(s.observacoes),
        created_at: String(s.created_at),
      })),
    });
  } catch (e) {
    return tratarErro(e);
  }
}

/**
 * POST /api/admin/solicitacoes — registro manual de solicitação recebida
 * pelo WhatsApp (RF-037, política da primeira versão).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const b = await lerCorpo<{
      nome?: string;
      telefone?: string;
      consultorio_id?: number;
      data?: string;
      inicio?: number;
      tipo?: string;
      observacoes?: string;
    }>(req);
    const nome = (b.nome || "").trim();
    const telefone = (b.telefone || "").trim();
    const data = b.data || "";
    const inicio = Number(b.inicio);
    const tipo = b.tipo || "avulsa";
    if (nome.length < 3) return erro(400, "Nome do interessado é obrigatório.");
    if (telefone.replace(/\D/g, "").length < 10) return erro(400, "Telefone inválido.");
    if (!["fixo", "avulsa", "reposicao"].includes(tipo)) return erro(400, "Tipo inválido.");
    const problema = validarGrade(data, inicio, inicio + 1);
    if (problema) return erro(400, problema);

    const db = getDb();
    const r = db
      .prepare(
        `INSERT INTO solicitacoes (nome, telefone, consultorio_id, data, inicio, fim, tipo, observacoes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(nome, telefone, Number(b.consultorio_id), data, inicio, inicio + 1, tipo, (b.observacoes || "").trim() || null);
    const id = Number(r.lastInsertRowid);
    registrarAuditoria(sessao.adminId, "criar", "solicitacao", id, `Registrou solicitação manual de ${nome}.`);
    return ok({ ok: true, id }, { status: 201 });
  } catch (e) {
    return tratarErro(e);
  }
}
