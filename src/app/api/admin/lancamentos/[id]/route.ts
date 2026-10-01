import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { carregarLancamento } from "@/lib/finance";
import { paraCentavos } from "@/lib/dates";
import { getDb } from "@/lib/db";
import type { SituacaoFinanceira } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

/** GET /api/admin/lancamentos/[id] — detalhe com pagamentos */
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  try {
    await exigirSessao();
    const { id } = await params;
    const lanc = carregarLancamento(Number(id));
    if (!lanc) return erro(404, "Lançamento não encontrado.");
    return ok({ lancamento: lanc });
  } catch (e) {
    return tratarErro(e);
  }
}

/** PUT /api/admin/lancamentos/[id] — edita valor/vencimento/situação (RF-047) */
export async function PUT(req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const atual = carregarLancamento(Number(id));
    if (!atual) return erro(404, "Lançamento não encontrado.");

    const b = await lerCorpo<{
      valor?: string | number;
      vencimento?: string;
      situacao?: string;
      observacoes?: string;
    }>(req);

    let valorCobrado = atual.valor_cobrado;
    if (b.valor !== undefined && b.valor !== "") {
      try {
        valorCobrado = paraCentavos(b.valor as string);
      } catch {
        return erro(400, "Valor inválido.");
      }
      if (valorCobrado < atual.valor_pago) {
        return erro(400, "Valor cobrado menor que o total já recebido.");
      }
    }
    const situacao = (b.situacao ?? atual.situacao) as SituacaoFinanceira;
    if (!["pendente", "pago", "parcial", "atrasado", "cancelado"].includes(situacao)) {
      return erro(400, "Situação inválida.");
    }
    if (situacao === "pago" && valorCobrado > atual.valor_pago) {
      return erro(400, "Não é possível marcar como pago havendo saldo pendente. Registre o pagamento restante.", {
        conflito: true,
      });
    }

    const db = getDb();
    db.prepare(
      "UPDATE lancamentos SET valor_cobrado = ?, vencimento = ?, situacao = ?, observacoes = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(
      valorCobrado,
      b.vencimento ?? atual.vencimento,
      situacao,
      (b.observacoes ?? atual.observacoes ?? "").trim() || null,
      Number(id)
    );
    registrarAuditoria(
      sessao.adminId,
      "editar",
      "lancamento",
      Number(id),
      `Lançamento #${id} atualizado (R$ ${(valorCobrado / 100).toFixed(2)}, situação: ${situacao}).`
    );
    return ok({ ok: true, lancamento: carregarLancamento(Number(id)) });
  } catch (e) {
    return tratarErro(e);
  }
}
