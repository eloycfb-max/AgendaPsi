import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { carregarLancamento, registrarPagamento } from "@/lib/finance";
import { paraCentavos, hojeIso } from "@/lib/dates";
import { getDb, transacao } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/lancamentos/[id]/pagamentos
 * Registra pagamento total ou parcial (RF-048). O saldo é recalculado
 * pelo somatório dos pagamentos (PRD 5.6) — nunca negativo, nunca duplicado.
 */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const b = await lerCorpo<{
      valor?: string | number;
      data_pagamento?: string;
      forma?: string;
      referencia?: string;
    }>(req);

    let valor: number;
    try {
      valor = paraCentavos(b.valor ?? "");
    } catch {
      return erro(400, "Valor do pagamento inválido.");
    }
    const dataPagamento = b.data_pagamento || hojeIso();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPagamento)) return erro(400, "Data do pagamento inválida.");
    const forma = (b.forma || "").trim();
    if (!forma) return erro(400, "Informe a forma de pagamento.");

    const lancamento = transacao(() =>
      registrarPagamento(Number(id), valor, dataPagamento, forma, (b.referencia || "").trim() || null)
    );

    registrarAuditoria(
      sessao.adminId,
      "pagar",
      "lancamento",
      Number(id),
      `Pagamento de R$ ${(valor / 100).toFixed(2)} (${forma}) registrado. Saldo: R$ ${(lancamento.saldo / 100).toFixed(2)}.`
    );
    return ok({ ok: true, lancamento });
  } catch (e) {
    return tratarErro(e);
  }
}

/** DELETE /api/admin/lancamentos/[id]/pagamentos?pagamento_id=N — estorna um pagamento */
export async function DELETE(req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const pagamentoId = Number(new URL(req.url).searchParams.get("pagamento_id"));
    if (!pagamentoId) return erro(400, "Informe o pagamento a estornar.");
    const db = getDb();
    const pag = db
      .prepare("SELECT * FROM pagamentos WHERE id = ? AND lancamento_id = ?")
      .get(pagamentoId, Number(id)) as Record<string, unknown> | undefined;
    if (!pag) return erro(404, "Pagamento não encontrado.");

    transacao(() => {
      db.prepare("DELETE FROM pagamentos WHERE id = ?").run(pagamentoId);
      const lanc = db.prepare("SELECT situacao FROM lancamentos WHERE id = ?").get(Number(id)) as { situacao: string };
      if (lanc.situacao !== "cancelado") {
        db.prepare("UPDATE lancamentos SET situacao = 'pendente', updated_at = datetime('now') WHERE id = ?").run(
          Number(id)
        );
      }
    });
    registrarAuditoria(
      sessao.adminId,
      "estornar",
      "lancamento",
      Number(id),
      `Estornou pagamento #${pagamentoId} de R$ ${(Number(pag.valor) / 100).toFixed(2)}.`
    );
    return ok({ ok: true, lancamento: carregarLancamento(Number(id)) });
  } catch (e) {
    return tratarErro(e);
  }
}
