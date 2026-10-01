"use client";

import { useCallback, useEffect, useState } from "react";
import { Indicador } from "@/components/Indicador";
import { DIAS_SEMANA, SITUACOES_FINANCEIRAS, type SituacaoFinanceira } from "@/lib/constants";
import { addDias, formatarData, formatarMoeda, hojeIso } from "@/lib/dates";

/* ---------------------------------------------------------------- tipos */

interface OcupacaoConsultorio {
  consultorio_id: number;
  consultorio: string;
  horas_disponiveis: number;
  horas_ocupadas: number;
  percentual: number;
}

interface Pagamento {
  id: number;
  valor: number;
  data_pagamento: string;
  forma: string;
  referencia: string | null;
}

interface LancamentoResumo {
  id: number;
  data_referencia: string;
  valor_cobrado: number;
  vencimento: string | null;
  situacao_efetiva: SituacaoFinanceira;
  valor_pago: number;
  saldo: number;
  nome_profissional: string;
  nome_consultorio: string;
  pagamentos: Pagamento[];
}

interface Relatorio {
  periodo: { de: string; ate: string; rotulo: string };
  ocupacao: OcupacaoConsultorio[];
  total_horas_ocupadas: number;
  por_dia_semana: { dia: string; quantidade: number }[];
  por_tipo: { tipo: string; quantidade: number }[];
  financeiro: {
    prevista: number;
    recebida: number;
    pendente: number;
    atrasado: number;
    por_consultorio: { consultorio: string; prevista: number; recebida: number }[];
    por_profissional: { profissional: string; prevista: number; recebida: number }[];
  };
  lancamentos: LancamentoResumo[];
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

/* ------------------------------------------------------------ utilidades */

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

const CORES_TIPO: Record<string, string> = {
  fixo: "bg-petroleo-700",
  avulsa: "bg-salvia-600",
  reposicao: "bg-laranja-500",
};

function rotuloTipo(tipo: string): string {
  if (tipo === "fixo" || tipo === "avulsa" || tipo === "reposicao") {
    return tipo === "fixo" ? "Horário Fixo" : tipo === "avulsa" ? "Avulso" : "Reposição";
  }
  return tipo;
}

/* -------------------------------------------------------------- página */

export default function PaginaRelatorios() {
  const [de, setDe] = useState<string>(() => addDias(hojeIso(), -30));
  const [ate, setAte] = useState<string>(() => hojeIso());
  const [dados, setDados] = useState<Relatorio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (de && ate && de > ate) {
      setDados(null);
      setErro("Período inválido: a data inicial é posterior à final.");
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await requisicao<Relatorio>(
        `/api/admin/relatorios?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`
      );
      setDados(resultado);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setCarregando(false);
    }
  }, [de, ate]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const urlExportar = (conjunto: string): string =>
    `/api/admin/relatorios/exportar?conjunto=${conjunto}&de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`;

  const maxDia = dados ? Math.max(1, ...dados.por_dia_semana.map((d) => d.quantidade)) : 1;
  const maxTipo = dados ? Math.max(1, ...dados.por_tipo.map((t) => t.quantidade)) : 1;

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
          <p className="text-sm text-slate-500">Ocupação e receita do período.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-secundario" href={urlExportar("ocupacao")} download>
            Exportar ocupação (CSV)
          </a>
          <a className="btn-secundario" href={urlExportar("lancamentos")} download>
            Exportar lançamentos (CSV)
          </a>
        </div>
      </div>

      <section className="card p-4" aria-label="Período do relatório">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="rotulo" htmlFor="rel-de">
              De
            </label>
            <input
              id="rel-de"
              className="campo"
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="rel-ate">
              Até
            </label>
            <input
              id="rel-ate"
              className="campo"
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
            />
          </div>
          <button type="button" className="btn-primario" onClick={() => void carregar()} disabled={carregando}>
            {carregando ? "Gerando..." : "Gerar relatório"}
          </button>
          {dados && <p className="pb-2 text-sm text-slate-500">Período: {dados.periodo.rotulo}</p>}
        </div>
      </section>

      {carregando ? (
        <p role="status" className="card p-6 text-center text-sm text-slate-500">
          Carregando relatório...
        </p>
      ) : erro ? (
        <div role="alert" className="card p-6 text-center">
          <p className="font-medium text-red-700">{erro}</p>
          <button type="button" className="btn-secundario mt-4" onClick={() => void carregar()}>
            Tentar novamente
          </button>
        </div>
      ) : !dados ? (
        <p className="card p-6 text-center text-sm text-slate-500">Nenhum dado para o período selecionado.</p>
      ) : (
        <>
          {/* ------------------------------------------------- indicadores */}
          <section aria-label="Indicadores do período" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Indicador
              rotulo="Horas ocupadas"
              valor={String(dados.total_horas_ocupadas)}
              detalhe="Ocorrências de segunda a sábado"
            />
            <Indicador rotulo="Receita prevista" valor={formatarMoeda(dados.financeiro.prevista)} />
            <Indicador rotulo="Receita recebida" valor={formatarMoeda(dados.financeiro.recebida)} tom="positivo" />
            <Indicador rotulo="Saldo pendente" valor={formatarMoeda(dados.financeiro.pendente)} tom="atencao" />
            <Indicador rotulo="Em atraso" valor={formatarMoeda(dados.financeiro.atrasado)} tom="alerta" />
          </section>

          {/* ---------------------------------------------------- ocupação */}
          <section className="card p-5" aria-label="Ocupação por consultório">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Ocupação por consultório</h2>
            {dados.ocupacao.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum consultório cadastrado.</p>
            ) : (
              <ul className="space-y-4">
                {dados.ocupacao.map((o) => (
                  <li key={o.consultorio_id}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-800">{o.consultorio}</span>
                      <span className="text-slate-500">
                        {o.horas_ocupadas}h de {o.horas_disponiveis}h · {o.percentual}%
                      </span>
                    </div>
                    <div
                      className="h-3 w-full overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                      aria-label={`Ocupação de ${o.consultorio}`}
                      aria-valuenow={o.percentual}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-3 rounded-full bg-petroleo-600 transition-all"
                        style={{ width: `${Math.min(o.percentual, 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ------------------------------------------------------ gráficos */}
          <section aria-label="Gráficos de ocupação" className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Ocupação por dia da semana</h2>
              {dados.por_dia_semana.every((d) => d.quantidade === 0) ? (
                <p className="text-sm text-slate-500">Sem ocorrências no período.</p>
              ) : (
                <div className="flex items-end gap-2">
                  {dados.por_dia_semana.map((d, i) => (
                    <div key={d.dia} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-xs font-medium text-slate-600">{d.quantidade}</span>
                      <div className="flex h-32 w-full items-end">
                        <div
                          className="w-full rounded-t-md bg-petroleo-600"
                          style={{ height: `${(d.quantidade / maxDia) * 100}%` }}
                          role="img"
                          aria-label={`${DIAS_SEMANA[i].longo}: ${d.quantidade} ocorrências`}
                        />
                      </div>
                      <span className="text-xs text-slate-500">{DIAS_SEMANA[i].curto}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500">Eixo vertical: número de ocorrências no período.</p>
            </div>

            <div className="card p-5">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Ocupação por tipo</h2>
              {dados.por_tipo.every((t) => t.quantidade === 0) ? (
                <p className="text-sm text-slate-500">Sem ocorrências no período.</p>
              ) : (
                <ul className="space-y-3">
                  {dados.por_tipo.map((t) => (
                    <li key={t.tipo} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-sm text-slate-600">{rotuloTipo(t.tipo)}</span>
                      <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
                        <div
                          className={`h-4 rounded ${CORES_TIPO[t.tipo] ?? "bg-slate-400"}`}
                          style={{ width: `${(t.quantidade / maxTipo) * 100}%` }}
                          role="img"
                          aria-label={`${rotuloTipo(t.tipo)}: ${t.quantidade} ocorrências`}
                        />
                      </div>
                      <span className="w-10 text-right text-sm font-semibold text-slate-800">{t.quantidade}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-petroleo-700" aria-hidden="true" /> Horário Fixo
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-salvia-600" aria-hidden="true" /> Avulso
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-laranja-500" aria-hidden="true" /> Reposição
                </span>
              </div>
            </div>
          </section>

          {/* ------------------------------------------------------- receita */}
          <section aria-label="Receita por consultório e profissional" className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Receita por consultório</h2>
              {dados.financeiro.por_consultorio.length === 0 ? (
                <p className="text-sm text-slate-500">Sem lançamentos no período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Consultório
                        </th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">
                          Prevista
                        </th>
                        <th scope="col" className="py-2 text-right font-medium">
                          Recebida
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.financeiro.por_consultorio.map((c) => (
                        <tr key={c.consultorio} className="border-b border-slate-100">
                          <td className="py-2 pr-3 text-slate-800">{c.consultorio}</td>
                          <td className="py-2 pr-3 text-right">{formatarMoeda(c.prevista)}</td>
                          <td className="py-2 text-right">{formatarMoeda(c.recebida)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card p-5">
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Receita por profissional</h2>
              {dados.financeiro.por_profissional.length === 0 ? (
                <p className="text-sm text-slate-500">Sem lançamentos no período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Profissional
                        </th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">
                          Prevista
                        </th>
                        <th scope="col" className="py-2 text-right font-medium">
                          Recebida
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.financeiro.por_profissional.map((p) => (
                        <tr key={p.profissional} className="border-b border-slate-100">
                          <td className="py-2 pr-3 text-slate-800">{p.profissional}</td>
                          <td className="py-2 pr-3 text-right">{formatarMoeda(p.prevista)}</td>
                          <td className="py-2 text-right">{formatarMoeda(p.recebida)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* --------------------------------------------------- lançamentos */}
          <section className="card p-5" aria-label="Lançamentos do período">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              Lançamentos do período ({dados.lancamentos.length})
            </h2>
            {dados.lancamentos.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum lançamento no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Data ref.
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Profissional
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Consultório
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">
                        Cobrado
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">
                        Recebido
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">
                        Saldo
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        Situação
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.lancamentos.map((l) => (
                      <tr key={l.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3">{formatarData(l.data_referencia)}</td>
                        <td className="py-2 pr-3 text-slate-800">{l.nome_profissional}</td>
                        <td className="py-2 pr-3 text-slate-600">{l.nome_consultorio}</td>
                        <td className="py-2 pr-3 text-right">{formatarMoeda(l.valor_cobrado)}</td>
                        <td className="py-2 pr-3 text-right">{formatarMoeda(l.valor_pago)}</td>
                        <td className="py-2 pr-3 text-right">{formatarMoeda(l.saldo)}</td>
                        <td className="py-2">
                          <BadgeSituacao situacao={l.situacao_efetiva} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
