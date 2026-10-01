import { getDb, limpar, limparTodos } from "./db";
import { hojeIso } from "./dates";
import { ValidacaoError } from "./http";
import type { SituacaoFinanceira } from "./constants";

export interface Lancamento {
  id: number;
  profissional_id: number;
  reserva_id: number | null;
  consultorio_id: number;
  data_referencia: string;
  valor_cobrado: number;
  vencimento: string | null;
  situacao: SituacaoFinanceira;
  observacoes: string | null;
}

export interface LancamentoCompleto extends Lancamento {
  nome_profissional: string;
  nome_consultorio: string;
  valor_pago: number;
  saldo: number;
  situacao_efetiva: SituacaoFinanceira;
  pagamentos: {
    id: number;
    valor: number;
    data_pagamento: string;
    forma: string;
    referencia: string | null;
    created_at: string;
  }[];
}

/** Total de pagamentos válidos registrados no lançamento. */
export function totalPago(lancamentoId: number): number {
  const db = getDb();
  const linha = db
    .prepare("SELECT COALESCE(SUM(valor), 0) AS total FROM pagamentos WHERE lancamento_id = ?")
    .get(lancamentoId) as { total: number };
  return Number(linha.total);
}

/**
 * Situação efetiva derivada (PRD 5.6):
 * cancelado > pago (saldo zero) > parcial > atraso (vencido e saldo) > pendente.
 */
export function situacaoEfetiva(
  situacaoSalva: SituacaoFinanceira,
  valorCobrado: number,
  pago: number,
  vencimento: string | null
): SituacaoFinanceira {
  if (situacaoSalva === "cancelado") return "cancelado";
  const saldo = valorCobrado - pago;
  if (saldo <= 0) return "pago";
  if (pago > 0) return vencimento && vencimento < hojeIso() ? "atrasado" : "parcial";
  return vencimento && vencimento < hojeIso() ? "atrasado" : "pendente";
}

export function carregarLancamento(id: number): LancamentoCompleto | null {
  const db = getDb();
  const linha = db
    .prepare(
      `SELECT l.*, p.nome_completo AS nome_profissional, c.nome AS nome_consultorio
       FROM lancamentos l
       JOIN profissionais p ON p.id = l.profissional_id
       JOIN consultorios c ON c.id = l.consultorio_id
       WHERE l.id = ?`
    )
    .get(id);
  if (!linha) return null;
  const base = limpar<Record<string, unknown>>(linha);
  const pagamentos = limparTodos<Record<string, unknown>>(
    db.prepare("SELECT * FROM pagamentos WHERE lancamento_id = ? ORDER BY data_pagamento, id").all(id) as never[]
  );
  const pago = pagamentos.reduce((s, p) => s + Number(p.valor), 0);
  const situacaoSalva = base.situacao as SituacaoFinanceira;
  return {
    id: Number(base.id),
    profissional_id: Number(base.profissional_id),
    reserva_id: base.reserva_id === null ? null : Number(base.reserva_id),
    consultorio_id: Number(base.consultorio_id),
    data_referencia: String(base.data_referencia),
    valor_cobrado: Number(base.valor_cobrado),
    vencimento: base.vencimento === null ? null : String(base.vencimento),
    situacao: situacaoSalva,
    observacoes: base.observacoes === null ? null : String(base.observacoes),
    nome_profissional: String(base.nome_profissional),
    nome_consultorio: String(base.nome_consultorio),
    valor_pago: pago,
    saldo: Number(base.valor_cobrado) - pago,
    situacao_efetiva: situacaoEfetiva(situacaoSalva, Number(base.valor_cobrado), pago, base.vencimento ? String(base.vencimento) : null),
    pagamentos: pagamentos.map((p) => ({
      id: Number(p.id),
      valor: Number(p.valor),
      data_pagamento: String(p.data_pagamento),
      forma: String(p.forma),
      referencia: p.referencia === null ? null : String(p.referencia),
      created_at: String(p.created_at),
    })),
  };
}

/**
 * Registra um pagamento total ou parcial (RF-048), transacionalmente,
 * impedindo valores negativos ou acima do saldo (PRD 5.6).
 */
export function registrarPagamento(
  lancamentoId: number,
  valor: number,
  dataPagamento: string,
  forma: string,
  referencia: string | null
): LancamentoCompleto {
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new ValidacaoError("O valor do pagamento deve ser maior que zero.");
  }
  const db = getDb();
  const lanc = carregarLancamento(lancamentoId);
  if (!lanc) throw new ValidacaoError("Lançamento não encontrado.");
  if (lanc.situacao_efetiva === "cancelado") {
    throw new ValidacaoError("Não é possível registrar pagamento em lançamento cancelado.");
  }
  if (valor > lanc.saldo) {
    throw new ValidacaoError(
      `Valor maior que o saldo pendente (R$ ${(lanc.saldo / 100).toFixed(2)}). Pagamentos duplicados não são permitidos.`
    );
  }
  db.prepare(
    "INSERT INTO pagamentos (lancamento_id, valor, data_pagamento, forma, referencia) VALUES (?, ?, ?, ?, ?)"
  ).run(lancamentoId, valor, dataPagamento, forma, referencia);
  return carregarLancamento(lancamentoId)!;
}

/** Indicadores financeiros do painel (RF-050). */
export function indicadoresFinanceiros(filtros: {
  de?: string;
  ate?: string;
  profissionalId?: number;
  consultorioId?: number;
  situacao?: string;
}) {
  const db = getDb();
  const cond: string[] = [];
  const params: unknown[] = [];
  if (filtros.de) {
    cond.push("l.data_referencia >= ?");
    params.push(filtros.de);
  }
  if (filtros.ate) {
    cond.push("l.data_referencia <= ?");
    params.push(filtros.ate);
  }
  if (filtros.profissionalId) {
    cond.push("l.profissional_id = ?");
    params.push(filtros.profissionalId);
  }
  if (filtros.consultorioId) {
    cond.push("l.consultorio_id = ?");
    params.push(filtros.consultorioId);
  }
  const where = cond.length ? " WHERE " + cond.join(" AND ") : "";

  const linhas = limparTodos<Record<string, unknown>>(
    db
      .prepare(
        `SELECT l.id, l.valor_cobrado, l.vencimento, l.situacao,
                l.consultorio_id, l.profissional_id,
                COALESCE((SELECT SUM(valor) FROM pagamentos p WHERE p.lancamento_id = l.id), 0) AS pago
         FROM lancamentos l${where}`
      )
      .all(...(params as never[])) as never[]
  );

  let prevista = 0;
  let recebida = 0;
  let pendente = 0;
  let atrasado = 0;
  const porConsultorio = new Map<number, { prevista: number; recebida: number }>();
  const porProfissional = new Map<number, { prevista: number; recebida: number }>();

  for (const l of linhas) {
    const situacaoSalva = l.situacao as SituacaoFinanceira;
    if (situacaoSalva === "cancelado") continue;
    const cobrado = Number(l.valor_cobrado);
    const pago = Number(l.pago);
    const sit = situacaoEfetiva(situacaoSalva, cobrado, pago, l.vencimento ? String(l.vencimento) : null);
    prevista += cobrado;
    recebida += pago;
    const saldo = cobrado - pago;
    if (saldo > 0) pendente += saldo;
    if (sit === "atrasado") atrasado += saldo;

    const cId = Number(l.consultorio_id);
    const pId = Number(l.profissional_id);
    const rc = porConsultorio.get(cId) ?? { prevista: 0, recebida: 0 };
    rc.prevista += cobrado;
    rc.recebida += pago;
    porConsultorio.set(cId, rc);
    const rp = porProfissional.get(pId) ?? { prevista: 0, recebida: 0 };
    rp.prevista += cobrado;
    rp.recebida += pago;
    porProfissional.set(pId, rp);
  }

  return {
    prevista,
    recebida,
    pendente,
    atrasado,
    porConsultorio: [...porConsultorio.entries()].map(([id, v]) => ({ consultorio_id: id, ...v })),
    porProfissional: [...porProfissional.entries()].map(([id, v]) => ({ profissional_id: id, ...v })),
  };
}
