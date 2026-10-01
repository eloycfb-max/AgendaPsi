import { getDb } from "@/lib/db";
import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { paraCentavos } from "@/lib/dates";

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/consultorios/[id]/precos — cadastra valor por tipo (RF-056) */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const db = getDb();
    const sala = db.prepare("SELECT nome FROM consultorios WHERE id = ?").get(Number(id));
    if (!sala) return erro(404, "Consultório não encontrado.");

    const b = await lerCorpo<{
      tipo?: string;
      valor?: string | number;
      vigencia_inicio?: string;
      vigencia_fim?: string;
    }>(req);
    if (!["fixo", "avulsa", "reposicao"].includes(b.tipo || "")) return erro(400, "Tipo inválido.");
    let valorCents: number;
    try {
      valorCents = paraCentavos(b.valor ?? "");
    } catch {
      return erro(400, "Informe um valor válido (ex.: 120,00).");
    }
    if (valorCents < 0) return erro(400, "O valor não pode ser negativo."); // 0 = tipo não cobrado (ex.: reposição grátis)
    const vigencia = b.vigencia_inicio || new Date().toISOString().slice(0, 10);

    const r = db
      .prepare(
        `INSERT INTO precos (consultorio_id, tipo, valor_cents, vigencia_inicio, vigencia_fim)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(Number(id), b.tipo!, valorCents, vigencia, b.vigencia_fim || null);
    registrarAuditoria(
      sessao.adminId,
      "criar",
      "preco",
      Number(r.lastInsertRowid),
      `Novo preço ${b.tipo} no consultório #${id}: R$ ${(valorCents / 100).toFixed(2)}.`
    );
    return ok({ ok: true, id: Number(r.lastInsertRowid) }, { status: 201 });
  } catch (e) {
    return tratarErro(e);
  }
}
