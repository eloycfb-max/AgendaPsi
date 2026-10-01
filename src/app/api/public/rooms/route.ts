import { getDb, limparTodos } from "@/lib/db";
import { ok, tratarErro } from "@/lib/http";
import { hojeIso } from "@/lib/dates";

/**
 * GET /api/public/rooms
 * Consultórios com descrição, recursos, fotos e preços vigentes.
 * Nenhum dado pessoal é retornado (RF-016 / CA-007).
 */
export async function GET(): Promise<Response> {
  try {
    const db = getDb();
    const salas = limparTodos<Record<string, unknown>>(
      db
        .prepare("SELECT * FROM consultorios WHERE situacao = 'ativo' ORDER BY id")
        .all() as never[]
    );
    const hoje = hojeIso();

    const resultado = salas.map((s) => {
      const fotos = limparTodos<Record<string, unknown>>(
        db
          .prepare(
            "SELECT id, arquivo, alt, ordem FROM fotos WHERE consultorio_id = ? AND situacao = 'ativo' ORDER BY ordem, id"
          )
          .all(Number(s.id)) as never[]
      );
      const precos = limparTodos<Record<string, unknown>>(
        db
          .prepare(
            `SELECT tipo, valor_cents FROM precos
             WHERE consultorio_id = ? AND situacao = 'ativo'
               AND vigencia_inicio <= ? AND (vigencia_fim IS NULL OR vigencia_fim >= ?)
             ORDER BY tipo`
          )
          .all(Number(s.id), hoje, hoje) as never[]
      );
      return {
        id: Number(s.id),
        nome: String(s.nome),
        slug: String(s.slug),
        descricao: String(s.descricao),
        recursos: String(s.recursos)
          .split(";")
          .map((r) => r.trim())
          .filter(Boolean),
        fotos: fotos.map((f) => ({
          id: Number(f.id),
          url: `/api/arquivos/${f.arquivo}`,
          alt: String(f.alt || s.nome),
          ordem: Number(f.ordem),
        })),
        precos: Object.fromEntries(
          precos.map((p) => [String(p.tipo), Number(p.valor_cents)])
        ) as Record<string, number>,
      };
    });

    return ok({ consultorios: resultado });
  } catch (e) {
    return tratarErro(e);
  }
}
