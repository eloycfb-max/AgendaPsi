"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { Indicador } from "@/components/Indicador";
import {
  FORMAS_PAGAMENTO,
  SITUACOES_FINANCEIRAS,
  type SituacaoFinanceira,
} from "@/lib/constants";
import { formatarData, formatarMoeda, hojeIso } from "@/lib/dates";

/* ---------------------------------------------------------------- tipos */

interface Pagamento {
  id: number;
  valor: number;
  data_pagamento: string;
  forma: string;
  referencia: string | null;
}

interface Lancamento {
  id: number;
  profissional_id: number;
  consultorio_id: number;
  data_referencia: string;
  valor_cobrado: number;
  vencimento: string | null;
  situacao: SituacaoFinanceira;
  situacao_efetiva: SituacaoFinanceira;
  valor_pago: number;
  saldo: number;
  nome_profissional: string;
  nome_consultorio: string;
  observacoes: string | null;
  pagamentos: Pagamento[];
}

interface Profissional {
  id: number;
  nome: string;
}

interface Consultorio {
  id: number;
  nome: string;
}

interface FormPagamento {
  valor: string;
  data_pagamento: string;
  forma: string;
  referencia: string;
}

interface FormEdicao {
  valor: string;
  vencimento: string;
  situacao: string;
  observacoes: string;
}

interface FormNovo {
  profissional_id: string;
  consultorio_id: string;
  data_referencia: string;
  valor: string;
  vencimento: string;
  observacoes: string;
}

interface Mensagem {
  tipo: "ok" | "erro";
  texto: string;
}

/* ------------------------------------------------------- helper de rede */

class RequisicaoErro extends Error {
  readonly status: number;

  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.name = "RequisicaoErro";
    this.status = status;
  }
}

function mensagemDe(e: unknown): string {
  return e instanceof Error ? e.message : "Erro inesperado.";
}

async function requisicao<T>(url: string, init?: RequestInit): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(url, init);
  } catch {
    throw new RequisicaoErro(0, "Falha na conexão");
  }
  if (resposta.status === 401) {
    window.location.href = "/login?expirada=1";
    throw new RequisicaoErro(401, "Sessão expirada.");
  }
  let dados: unknown = null;
  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }
  if (!resposta.ok) {
    const corpo = dados as { erro?: unknown } | null;
    const mensagem =
      corpo && typeof corpo.erro === "string" ? corpo.erro : `Erro ${resposta.status} ao processar a solicitação.`;
    throw new RequisicaoErro(resposta.status, mensagem);
  }
  return dados as T;
}

function corpoJson(metodo: string, dados: unknown): RequestInit {
  return {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  };
}

/* ------------------------------------------------------------ utilidades */

function textoMoeda(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

const CORES_SITUACAO: Record<SituacaoFinanceira, string> = {
  pago: "bg-green-100 text-green-800",
  parcial: "bg-blue-100 text-blue-800",
  pendente: "bg-slate-100 text-slate-700",
  atrasado: "bg-red-100 text-red-800",
  cancelado: "bg-slate-100 text-slate-500 line-through",
};

function BadgeSituacao({ situacao }: { situacao: SituacaoFinanceira }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${CORES_SITUACAO[situacao]}`}>
      {SITUACOES_FINANCEIRAS[situacao]}
    </span>
  );
}

const FORM_PAGAMENTO_VAZIO: FormPagamento = {
  valor: "",
  data_pagamento: hojeIso(),
  forma: "Pix",
  referencia: "",
};

const FORM_NOVO_VAZIO: FormNovo = {
  profissional_id: "",
  consultorio_id: "",
  data_referencia: hojeIso(),
  valor: "",
  vencimento: "",
  observacoes: "",
};

/* -------------------------------------------------------------- página */

export default function PaginaFinanceiro() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [consultorios, setConsultorios] = useState<Consultorio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const [destaqueId, setDestaqueId] = useState<number | null>(null);

  // filtros
  const [fProfissional, setFProfissional] = useState("");
  const [fConsultorio, setFConsultorio] = useState("");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");
  const [fSituacao, setFSituacao] = useState("todas");

  // registrar pagamento
  const [pagando, setPagando] = useState<Lancamento | null>(null);
  const [formPag, setFormPag] = useState<FormPagamento>(FORM_PAGAMENTO_VAZIO);
  const [erroPag, setErroPag] = useState<string | null>(null);
  const [salvandoPag, setSalvandoPag] = useState(false);

  // detalhes / estorno
  const [detalheId, setDetalheId] = useState<number | null>(null);
  const [pagamentoEstornar, setPagamentoEstornar] = useState<number | null>(null);
  const [erroEstorno, setErroEstorno] = useState<string | null>(null);
  const [estornando, setEstornando] = useState(false);

  // editar
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [formEdicao, setFormEdicao] = useState<FormEdicao>({
    valor: "",
    vencimento: "",
    situacao: "pendente",
    observacoes: "",
  });
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // novo lançamento
  const [novoAberto, setNovoAberto] = useState(false);
  const [formNovo, setFormNovo] = useState<FormNovo>(FORM_NOVO_VAZIO);
  const [erroNovo, setErroNovo] = useState<string | null>(null);
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    const params = new URLSearchParams();
    if (fProfissional) params.set("profissional_id", fProfissional);
    if (fConsultorio) params.set("consultorio_id", fConsultorio);
    if (fDe) params.set("de", fDe);
    if (fAte) params.set("ate", fAte);
    if (fSituacao !== "todas") params.set("situacao", fSituacao);
    const qs = params.toString();
    try {
      const dados = await requisicao<{ lancamentos: Lancamento[] }>(
        `/api/admin/lancamentos${qs ? `?${qs}` : ""}`
      );
      setLancamentos(dados.lancamentos);
    } catch (e) {
      setErroLista(mensagemDe(e));
    } finally {
      setCarregando(false);
    }
  }, [fProfissional, fConsultorio, fDe, fAte, fSituacao]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const carregarApoio = useCallback(async () => {
    try {
      const [profs, salas] = await Promise.all([
        requisicao<{ profissionais: Profissional[] }>("/api/admin/profissionais?incluir_inativos=1"),
        requisicao<{ consultorios: Consultorio[] }>("/api/admin/consultorios"),
      ]);
      setProfissionais(profs.profissionais);
      setConsultorios(salas.consultorios);
    } catch {
      // a lista de lançamentos continua utilizável mesmo sem os selects
    }
  }, []);

  useEffect(() => {
    void carregarApoio();
  }, [carregarApoio]);

  useEffect(() => {
    if (destaqueId === null) return;
    const timer = window.setTimeout(() => setDestaqueId(null), 6000);
    return () => window.clearTimeout(timer);
  }, [destaqueId]);

  /* ------------------------------------------------------ indicadores */

  const indicadores = useMemo(() => {
    const validos = lancamentos.filter((l) => l.situacao_efetiva !== "cancelado");
    const prevista = validos.reduce((s, l) => s + l.valor_cobrado, 0);
    const recebida = validos.reduce((s, l) => s + l.valor_pago, 0);
    const saldo = validos.reduce((s, l) => s + l.saldo, 0);
    const atraso = validos
      .filter((l) => l.situacao_efetiva === "atrasado")
      .reduce((s, l) => s + l.saldo, 0);
    return { prevista, recebida, saldo, atraso };
  }, [lancamentos]);

  /* --------------------------------------------------------- exportação */

  const urlExportacao = useMemo(() => {
    const params = new URLSearchParams();
    params.set("conjunto", "lancamentos");
    if (fDe) params.set("de", fDe);
    if (fAte) params.set("ate", fAte);
    if (fProfissional) params.set("profissional_id", fProfissional);
    if (fConsultorio) params.set("consultorio_id", fConsultorio);
    if (fSituacao !== "todas") params.set("situacao", fSituacao);
    return `/api/admin/relatorios/exportar?${params.toString()}`;
  }, [fDe, fAte, fProfissional, fConsultorio, fSituacao]);

  function limparFiltros(): void {
    setFProfissional("");
    setFConsultorio("");
    setFDe("");
    setFAte("");
    setFSituacao("todas");
  }

  /* ------------------------------------------------ registrar pagamento */

  function abrirPagamento(l: Lancamento): void {
    setFormPag({
      ...FORM_PAGAMENTO_VAZIO,
      data_pagamento: hojeIso(),
      valor: l.saldo > 0 ? textoMoeda(l.saldo) : textoMoeda(l.valor_cobrado),
    });
    setErroPag(null);
    setPagando(l);
  }

  async function registrarPagamento(): Promise<void> {
    if (!pagando) return;
    if (!formPag.valor.trim()) {
      setErroPag("Informe o valor do pagamento.");
      return;
    }
    setSalvandoPag(true);
    setErroPag(null);
    try {
      await requisicao(
        `/api/admin/lancamentos/${pagando.id}/pagamentos`,
        corpoJson("POST", {
          valor: formPag.valor.trim(),
          data_pagamento: formPag.data_pagamento,
          forma: formPag.forma,
          referencia: formPag.referencia.trim() || undefined,
        })
      );
      setPagando(null);
      setDestaqueId(pagando.id);
      setMensagem({ tipo: "ok", texto: "Pagamento registrado com sucesso." });
      await carregar();
    } catch (e) {
      if (e instanceof RequisicaoErro && e.status === 400) {
        setErroPag(e.message);
      } else {
        setErroPag(mensagemDe(e));
      }
    } finally {
      setSalvandoPag(false);
    }
  }

  /* ------------------------------------------------------------ estorno */

  async function estornar(lancamentoId: number, pagamentoId: number): Promise<void> {
    setEstornando(true);
    setErroEstorno(null);
    try {
      await requisicao(
        `/api/admin/lancamentos/${lancamentoId}/pagamentos?pagamento_id=${pagamentoId}`,
        { method: "DELETE" }
      );
      setPagamentoEstornar(null);
      setMensagem({ tipo: "ok", texto: "Pagamento estornado." });
      await carregar();
    } catch (e) {
      setErroEstorno(mensagemDe(e));
    } finally {
      setEstornando(false);
    }
  }

  /* ----------------------------------------------------------- edição */

  function abrirEdicao(l: Lancamento): void {
    setFormEdicao({
      valor: textoMoeda(l.valor_cobrado),
      vencimento: l.vencimento ?? "",
      situacao: l.situacao,
      observacoes: l.observacoes ?? "",
    });
    setErroEdicao(null);
    setEditando(l);
  }

  async function salvarEdicao(): Promise<void> {
    if (!editando) return;
    setSalvandoEdicao(true);
    setErroEdicao(null);
    try {
      await requisicao(
        `/api/admin/lancamentos/${editando.id}`,
        corpoJson("PUT", {
          valor: formEdicao.valor.trim() || undefined,
          vencimento: formEdicao.vencimento || undefined,
          situacao: formEdicao.situacao,
          observacoes: formEdicao.observacoes.trim(),
        })
      );
      setEditando(null);
      setDestaqueId(editando.id);
      setMensagem({ tipo: "ok", texto: "Lançamento atualizado." });
      await carregar();
    } catch (e) {
      if (e instanceof RequisicaoErro && (e.status === 400 || e.status === 409)) {
        setErroEdicao(e.message);
      } else {
        setErroEdicao(mensagemDe(e));
      }
    } finally {
      setSalvandoEdicao(false);
    }
  }

  /* ------------------------------------------------------ novo lançamento */

  function abrirNovo(): void {
    setFormNovo(FORM_NOVO_VAZIO);
    setErroNovo(null);
    setNovoAberto(true);
  }

  async function salvarNovo(): Promise<void> {
    if (!formNovo.profissional_id) {
      setErroNovo("Selecione o profissional.");
      return;
    }
    if (!formNovo.consultorio_id) {
      setErroNovo("Selecione o consultório.");
      return;
    }
    if (!formNovo.data_referencia) {
      setErroNovo("Informe a data de referência.");
      return;
    }
    if (!formNovo.valor.trim()) {
      setErroNovo("Informe o valor cobrado.");
      return;
    }
    setSalvandoNovo(true);
    setErroNovo(null);
    try {
      await requisicao(
        "/api/admin/lancamentos",
        corpoJson("POST", {
          profissional_id: Number(formNovo.profissional_id),
          consultorio_id: Number(formNovo.consultorio_id),
          data_referencia: formNovo.data_referencia,
          valor: formNovo.valor.trim(),
          vencimento: formNovo.vencimento || undefined,
          observacoes: formNovo.observacoes.trim() || undefined,
        })
      );
      setNovoAberto(false);
      setMensagem({ tipo: "ok", texto: "Lançamento criado." });
      await carregar();
    } catch (e) {
      setErroNovo(mensagemDe(e));
    } finally {
      setSalvandoNovo(false);
    }
  }

  const detalhe = detalheId === null ? null : lancamentos.find((l) => l.id === detalheId) ?? null;

  /* ---------------------------------------------------------- render */

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financeiro</h1>
          <p className="text-sm text-slate-500">
            Lançamentos, pagamentos e saldos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-secundario" href={urlExportacao} download>
            Exportar CSV
          </a>
          <button type="button" className="btn-primario" onClick={abrirNovo}>
            Novo lançamento
          </button>
        </div>
      </div>

      {mensagem && (
        <p
          role={mensagem.tipo === "ok" ? "status" : "alert"}
          className={`rounded-lg border px-4 py-3 text-sm ${
            mensagem.tipo === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {mensagem.texto}
        </p>
      )}

      {/* --------------------------------------------------------- filtros */}
      <section className="card p-4" aria-label="Filtros de lançamentos">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="rotulo" htmlFor="f-profissional">
              Profissional
            </label>
            <select
              id="f-profissional"
              className="campo"
              value={fProfissional}
              onChange={(e) => setFProfissional(e.target.value)}
            >
              <option value="">Todos</option>
              {profissionais.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="f-consultorio">
              Consultório
            </label>
            <select
              id="f-consultorio"
              className="campo"
              value={fConsultorio}
              onChange={(e) => setFConsultorio(e.target.value)}
            >
              <option value="">Todos</option>
              {consultorios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="f-de">
              Período de
            </label>
            <input
              id="f-de"
              className="campo"
              type="date"
              value={fDe}
              onChange={(e) => setFDe(e.target.value)}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="f-ate">
              Período até
            </label>
            <input
              id="f-ate"
              className="campo"
              type="date"
              value={fAte}
              onChange={(e) => setFAte(e.target.value)}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="f-situacao">
              Situação
            </label>
            <select
              id="f-situacao"
              className="campo"
              value={fSituacao}
              onChange={(e) => setFSituacao(e.target.value)}
            >
              <option value="todas">Todas</option>
              <option value="pendente">{SITUACOES_FINANCEIRAS.pendente}</option>
              <option value="pago">{SITUACOES_FINANCEIRAS.pago}</option>
              <option value="parcial">{SITUACOES_FINANCEIRAS.parcial}</option>
              <option value="atrasado">{SITUACOES_FINANCEIRAS.atrasado}</option>
              <option value="cancelado">{SITUACOES_FINANCEIRAS.cancelado}</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" className="btn-secundario" onClick={limparFiltros}>
            Limpar filtros
          </button>
        </div>
      </section>

      {/* ----------------------------------------------------- indicadores */}
      <section aria-label="Indicadores financeiros" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Receita prevista" valor={formatarMoeda(indicadores.prevista)} />
        <Indicador rotulo="Recebida" valor={formatarMoeda(indicadores.recebida)} tom="positivo" />
        <Indicador rotulo="Saldo pendente" valor={formatarMoeda(indicadores.saldo)} tom="atencao" />
        <Indicador rotulo="Em atraso" valor={formatarMoeda(indicadores.atraso)} tom="alerta" />
      </section>

      {/* -------------------------------------------------------- listagem */}
      {carregando ? (
        <p role="status" className="card p-6 text-center text-sm text-slate-500">
          Carregando lançamentos...
        </p>
      ) : erroLista ? (
        <div role="alert" className="card p-6 text-center">
          <p className="font-medium text-red-700">{erroLista}</p>
          <button type="button" className="btn-secundario mt-4" onClick={() => void carregar()}>
            Tentar novamente
          </button>
        </div>
      ) : lancamentos.length === 0 ? (
        <p className="card p-6 text-center text-sm text-slate-500">
          Nenhum lançamento encontrado com os filtros atuais.
        </p>
      ) : (
        <section className="card overflow-hidden" aria-label="Lançamentos">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Profissional
                  </th>
                  <th scope="col" className="px-2 py-3 font-medium">
                    Consultório
                  </th>
                  <th scope="col" className="px-2 py-3 font-medium">
                    Data ref.
                  </th>
                  <th scope="col" className="px-2 py-3 font-medium">
                    Vencimento
                  </th>
                  <th scope="col" className="px-2 py-3 text-right font-medium">
                    Cobrado
                  </th>
                  <th scope="col" className="px-2 py-3 text-right font-medium">
                    Recebido
                  </th>
                  <th scope="col" className="px-2 py-3 text-right font-medium">
                    Saldo
                  </th>
                  <th scope="col" className="px-2 py-3 font-medium">
                    Situação
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((l) => (
                  <tr
                    key={l.id}
                    className={`border-b border-slate-100 ${
                      destaqueId === l.id ? "bg-petroleo-50 ring-1 ring-inset ring-petroleo-300" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{l.nome_profissional}</td>
                    <td className="px-2 py-3 text-slate-600">{l.nome_consultorio}</td>
                    <td className="px-2 py-3 text-slate-600">{formatarData(l.data_referencia)}</td>
                    <td className="px-2 py-3 text-slate-600">
                      {l.vencimento ? formatarData(l.vencimento) : "—"}
                    </td>
                    <td className="px-2 py-3 text-right text-slate-800">{formatarMoeda(l.valor_cobrado)}</td>
                    <td className="px-2 py-3 text-right text-slate-800">{formatarMoeda(l.valor_pago)}</td>
                    <td className="px-2 py-3 text-right text-slate-800">{formatarMoeda(l.saldo)}</td>
                    <td className="px-2 py-3">
                      <BadgeSituacao situacao={l.situacao_efetiva} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-secundario"
                          onClick={() => abrirPagamento(l)}
                          disabled={l.situacao_efetiva === "cancelado" || l.saldo <= 0}
                        >
                          Registrar pagamento
                        </button>
                        <button
                          type="button"
                          className="btn-secundario"
                          onClick={() => {
                            setPagamentoEstornar(null);
                            setErroEstorno(null);
                            setDetalheId(l.id);
                          }}
                        >
                          Detalhes
                        </button>
                        <button type="button" className="btn-secundario" onClick={() => abrirEdicao(l)}>
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ----------------------------------------------- registrar pagamento */}
      <Modal
        aberto={pagando !== null}
        aoFechar={() => setPagando(null)}
        titulo="Registrar pagamento"
        descricao={
          pagando ? `${pagando.nome_profissional} — saldo ${formatarMoeda(pagando.saldo)}` : undefined
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void registrarPagamento();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="pag-valor">
                Valor (R$)
              </label>
              <input
                id="pag-valor"
                className="campo"
                inputMode="decimal"
                required
                placeholder="120,00"
                value={formPag.valor}
                onChange={(e) => setFormPag({ ...formPag, valor: e.target.value })}
                aria-describedby="pag-valor-ajuda"
              />
              <p id="pag-valor-ajuda" className="mt-1 text-xs text-slate-500">
                Valor padrão: saldo pendente do lançamento.
              </p>
            </div>
            <div>
              <label className="rotulo" htmlFor="pag-data">
                Data do pagamento
              </label>
              <input
                id="pag-data"
                className="campo"
                type="date"
                required
                value={formPag.data_pagamento}
                onChange={(e) => setFormPag({ ...formPag, data_pagamento: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="pag-forma">
                Forma de pagamento
              </label>
              <select
                id="pag-forma"
                className="campo"
                value={formPag.forma}
                onChange={(e) => setFormPag({ ...formPag, forma: e.target.value })}
              >
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="rotulo" htmlFor="pag-referencia">
                Referência (opcional)
              </label>
              <input
                id="pag-referencia"
                className="campo"
                placeholder="Identificador do Pix, nº do comprovante"
                value={formPag.referencia}
                onChange={(e) => setFormPag({ ...formPag, referencia: e.target.value })}
              />
            </div>
          </div>
          {erroPag && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {erroPag}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secundario" onClick={() => setPagando(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primario" disabled={salvandoPag}>
              {salvandoPag ? "Salvando..." : "Registrar pagamento"}
            </button>
          </div>
        </form>
      </Modal>

      {/* -------------------------------------------------------- detalhes */}
      <Modal
        aberto={detalhe !== null}
        aoFechar={() => setDetalheId(null)}
        titulo="Detalhes do lançamento"
        descricao={detalhe ? `${detalhe.nome_profissional} — ${detalhe.nome_consultorio}` : undefined}
        largura="lg"
      >
        {detalhe && (
          <div className="space-y-4">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-1">
                <dt className="text-slate-500">Data de referência</dt>
                <dd className="font-medium text-slate-800">{formatarData(detalhe.data_referencia)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-1">
                <dt className="text-slate-500">Vencimento</dt>
                <dd className="font-medium text-slate-800">
                  {detalhe.vencimento ? formatarData(detalhe.vencimento) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-1">
                <dt className="text-slate-500">Valor cobrado</dt>
                <dd className="font-medium text-slate-800">{formatarMoeda(detalhe.valor_cobrado)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-1">
                <dt className="text-slate-500">Recebido</dt>
                <dd className="font-medium text-slate-800">{formatarMoeda(detalhe.valor_pago)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-1">
                <dt className="text-slate-500">Saldo</dt>
                <dd className="font-medium text-slate-800">{formatarMoeda(detalhe.saldo)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-1">
                <dt className="text-slate-500">Situação</dt>
                <dd>
                  <BadgeSituacao situacao={detalhe.situacao_efetiva} />
                </dd>
              </div>
            </dl>

            {detalhe.observacoes && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <span className="font-medium text-slate-700">Observações:</span> {detalhe.observacoes}
              </p>
            )}

            <section aria-label="Histórico de pagamentos">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Histórico de pagamentos
              </h3>
              {detalhe.pagamentos.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum pagamento registrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Data
                        </th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">
                          Valor
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Forma
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Referência
                        </th>
                        <th scope="col" className="py-2 font-medium">
                          Ação
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhe.pagamentos.map((p) => (
                        <tr key={p.id} className="border-b border-slate-100">
                          <td className="py-2 pr-3">{formatarData(p.data_pagamento)}</td>
                          <td className="py-2 pr-3 text-right">{formatarMoeda(p.valor)}</td>
                          <td className="py-2 pr-3">{p.forma}</td>
                          <td className="py-2 pr-3 text-slate-500">{p.referencia ?? "—"}</td>
                          <td className="py-2">
                            {pagamentoEstornar === p.id ? (
                              <span className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  className="btn-perigo px-3 py-1 text-xs"
                                  disabled={estornando}
                                  onClick={() => void estornar(detalhe.id, p.id)}
                                >
                                  {estornando ? "Estornando..." : "Confirmar"}
                                </button>
                                <button
                                  type="button"
                                  className="btn-secundario px-3 py-1 text-xs"
                                  disabled={estornando}
                                  onClick={() => setPagamentoEstornar(null)}
                                >
                                  Cancelar
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="btn-secundario px-3 py-1 text-xs"
                                onClick={() => {
                                  setPagamentoEstornar(p.id);
                                  setErroEstorno(null);
                                }}
                              >
                                Estornar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {erroEstorno && (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {erroEstorno}
                </p>
              )}
            </section>

            <div className="flex justify-end">
              <button type="button" className="btn-secundario" onClick={() => setDetalheId(null)}>
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------------------------------------------------- editar */}
      <Modal
        aberto={editando !== null}
        aoFechar={() => setEditando(null)}
        titulo="Editar lançamento"
        descricao={editando ? `${editando.nome_profissional} — ${editando.nome_consultorio}` : undefined}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void salvarEdicao();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="edt-valor">
                Valor cobrado (R$)
              </label>
              <input
                id="edt-valor"
                className="campo"
                inputMode="decimal"
                placeholder="120,00"
                value={formEdicao.valor}
                onChange={(e) => setFormEdicao({ ...formEdicao, valor: e.target.value })}
                aria-describedby="edt-valor-ajuda"
              />
              <p id="edt-valor-ajuda" className="mt-1 text-xs text-slate-500">
                Deixe em branco para manter o valor atual.
              </p>
            </div>
            <div>
              <label className="rotulo" htmlFor="edt-vencimento">
                Vencimento
              </label>
              <input
                id="edt-vencimento"
                className="campo"
                type="date"
                value={formEdicao.vencimento}
                onChange={(e) => setFormEdicao({ ...formEdicao, vencimento: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="rotulo" htmlFor="edt-situacao">
              Situação
            </label>
            <select
              id="edt-situacao"
              className="campo"
              value={formEdicao.situacao}
              onChange={(e) => setFormEdicao({ ...formEdicao, situacao: e.target.value })}
            >
              <option value="pendente">{SITUACOES_FINANCEIRAS.pendente}</option>
              <option value="pago">{SITUACOES_FINANCEIRAS.pago}</option>
              <option value="parcial">{SITUACOES_FINANCEIRAS.parcial}</option>
              <option value="atrasado">{SITUACOES_FINANCEIRAS.atrasado}</option>
              <option value="cancelado">Cancelar ({SITUACOES_FINANCEIRAS.cancelado})</option>
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="edt-observacoes">
              Observações
            </label>
            <textarea
              id="edt-observacoes"
              className="campo"
              rows={3}
              value={formEdicao.observacoes}
              onChange={(e) => setFormEdicao({ ...formEdicao, observacoes: e.target.value })}
            />
          </div>
          {erroEdicao && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {erroEdicao}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secundario" onClick={() => setEditando(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primario" disabled={salvandoEdicao}>
              {salvandoEdicao ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      </Modal>

      {/* --------------------------------------------------- novo lançamento */}
      <Modal
        aberto={novoAberto}
        aoFechar={() => setNovoAberto(false)}
        titulo="Novo lançamento"
        descricao="Registro manual de cobrança."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void salvarNovo();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="novo-profissional">
                Profissional *
              </label>
              <select
                id="novo-profissional"
                className="campo"
                required
                value={formNovo.profissional_id}
                onChange={(e) => setFormNovo({ ...formNovo, profissional_id: e.target.value })}
              >
                <option value="">Selecione...</option>
                {profissionais.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="rotulo" htmlFor="novo-consultorio">
                Consultório *
              </label>
              <select
                id="novo-consultorio"
                className="campo"
                required
                value={formNovo.consultorio_id}
                onChange={(e) => setFormNovo({ ...formNovo, consultorio_id: e.target.value })}
              >
                <option value="">Selecione...</option>
                {consultorios.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="rotulo" htmlFor="novo-data">
                Data de referência *
              </label>
              <input
                id="novo-data"
                className="campo"
                type="date"
                required
                value={formNovo.data_referencia}
                onChange={(e) => setFormNovo({ ...formNovo, data_referencia: e.target.value })}
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="novo-valor">
                Valor (R$) *
              </label>
              <input
                id="novo-valor"
                className="campo"
                inputMode="decimal"
                placeholder="120,00"
                required
                value={formNovo.valor}
                onChange={(e) => setFormNovo({ ...formNovo, valor: e.target.value })}
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="novo-vencimento">
                Vencimento
              </label>
              <input
                id="novo-vencimento"
                className="campo"
                type="date"
                value={formNovo.vencimento}
                onChange={(e) => setFormNovo({ ...formNovo, vencimento: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="rotulo" htmlFor="novo-observacoes">
              Observações
            </label>
            <textarea
              id="novo-observacoes"
              className="campo"
              rows={3}
              value={formNovo.observacoes}
              onChange={(e) => setFormNovo({ ...formNovo, observacoes: e.target.value })}
            />
          </div>

          {erroNovo && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {erroNovo}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secundario" onClick={() => setNovoAberto(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primario" disabled={salvandoNovo}>
              {salvandoNovo ? "Salvando..." : "Criar lançamento"}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
