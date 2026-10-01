import { getDb } from "@/lib/db";
import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { paraCentavos } from "@/lib/dates";

type Params = { params: Promise<{ id: string }> };

/** PUT /api/admin/precos/[id] — atualiza preço (não altera reservas antigas: RF-058) */
export async function PUT(req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const db = getDb();
    const atual = db.prepare("SELECT * FROM precos WHERE id = ?").get(Number(id));
    if (!atual) return erro(404, "Preço não encontrado.");
    const row = atual as unknown as Record<string, unknown>;

    const b = await lerCorpo<{ valor?: string | number; situacao?: string; vigencia_fim?: string }>(req);
    let valorCents = Number(row.valor_cents);
    if (b.valor !== undefined) {
      try {
        valorCents = paraCentavos(b.valor);
      } catch {
        return erro(400, "Valor inválido.");
      }
      if (valorCents <= 0) return erro(400, "O valor deve ser maior que zero.");
    }
    if (b.situacao && !["ativo", "inativo"].includes(b.situacao)) return erro(400, "Situação inválida.");

    db.prepare(
      "UPDATE precos SET valor_cents = ?, situacao = ?, vigencia_fim = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(valorCents, b.situacao ?? String(row.situacao), b.vigencia_fim ?? (row.vigencia_fim as string | null), Number(id));
    registrarAuditoria(
      sessao.adminId,
      "editar",
      "preco",
      Number(id),
      `Preço atualizado para R$ ${(valorCents / 100).toFixed(2)} (reservas antigas preservadas).`
    );
    return ok({ ok: true });
  } catch (e) {
    return tratarErro(e);
  }
}

/** DELETE /api/admin/precos/[id] */
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const db = getDb();
    db.prepare("DELETE FROM precos WHERE id = ?").run(Number(id));
    registrarAuditoria(sessao.adminId, "excluir", "preco", Number(id), "Removeu preço.");
    return ok({ ok: true });
  } catch (e) {
    return tratarErro(e);
  }
}
