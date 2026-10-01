import { getDb, limparTodos } from "@/lib/db";
import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";

/** GET /api/admin/consultorios — inclui fotos e preços (RF-043) */
export async function GET(): Promise<Response> {
  try {
    await exigirSessao();
    const db = getDb();
    const salas = limparTodos<Record<string, unknown>>(
      db.prepare("SELECT * FROM consultorios ORDER BY id").all() as never[]
    );
    const resultado = salas.map((s) => {
      const fotos = limparTodos<Record<string, unknown>>(
        db
          .prepare("SELECT * FROM fotos WHERE consultorio_id = ? ORDER BY ordem, id")
          .all(Number(s.id)) as never[]
      );
      const precos = limparTodos<Record<string, unknown>>(
        db
          .prepare("SELECT * FROM precos WHERE consultorio_id = ? ORDER BY tipo, vigencia_inicio DESC")
          .all(Number(s.id)) as never[]
      );
      return {
        id: Number(s.id),
        nome: String(s.nome),
        slug: String(s.slug),
        descricao: String(s.descricao),
        recursos: String(s.recursos),
        situacao: String(s.situacao),
        fotos: fotos.map((f) => ({
          id: Number(f.id),
          url: `/api/arquivos/${f.arquivo}`,
          alt: String(f.alt),
          ordem: Number(f.ordem),
          situacao: String(f.situacao),
        })),
        precos: precos.map((p) => ({
          id: Number(p.id),
          tipo: String(p.tipo),
          valor_cents: Number(p.valor_cents),
          vigencia_inicio: String(p.vigencia_inicio),
          vigencia_fim: p.vigencia_fim === null ? null : String(p.vigencia_fim),
          situacao: String(p.situacao),
        })),
      };
    });
    return ok({ consultorios: resultado });
  } catch (e) {
    return tratarErro(e);
  }
}

/** POST /api/admin/consultorios */
export async function POST(req: Request): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const b = await lerCorpo<{ nome?: string; slug?: string; descricao?: string; recursos?: string }>(req);
    const nome = (b.nome || "").trim();
    if (!nome) return erro(400, "Nome é obrigatório.");
    const slug =
      (b.slug || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-") ||
      `consultorio-${Date.now()}`;
    const db = getDb();
    try {
      const r = db
        .prepare("INSERT INTO consultorios (nome, slug, descricao, recursos) VALUES (?, ?, ?, ?)")
        .run(nome, slug, (b.descricao || "").trim(), (b.recursos || "").trim());
      const id = Number(r.lastInsertRowid);
      registrarAuditoria(sessao.adminId, "criar", "consultorio", id, `Cadastrou ${nome}.`);
      return ok({ ok: true, id }, { status: 201 });
    } catch (e) {
      if (String(e).includes("UNIQUE")) return erro(409, "Já existe um consultório com esse identificador.");
      throw e;
    }
  } catch (e) {
    return tratarErro(e);
  }
}
