"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Indicador } from "@/components/Indicador";
import { DIAS_SEMANA, TIPOS_RESERVA, type TipoReserva } from "@/lib/constants";
import { formatarDataCurta, formatarHora, formatarMoeda } from "@/lib/dates";
import { fetchAdmin, mensagemDe } from "./fetchAdmin";

/* ---------------------------------------------------------------- tipos */

interface OcorrenciaDashboard {
  consultorio_id: number;
  data: string;
  inicio: number;
  fim: number;
  tipo: TipoReserva;
  reserva_id: number | null;
  recorrencia_id: number | null;
  profissional_id: number;
  nome_profissional: string;
  nome_consultorio: string;
  valor_acordado: number | null;
  observacoes: string | null;
}

interface SolicitacaoPendente {
  id: number;
  nome: string;
  telefone: string;
  data: string;
  inicio: number;
  tipo: string;
  nome_consultorio: string;
}

interface FixoAtivo {
  id: number;
  dia_semana: number;
  inicio: number;
  nome_consultorio: string;
  nome_profissional: string;
  data_fim: string | null;
}

interface RespostaDashboard {
  hoje: string;
  rotulo_hoje: string;
  reservas_do_dia: OcorrenciaDashboard[];
  proximas_reservas: OcorrenciaDashboard[];
  solicitacoes_pendentes: SolicitacaoPendente[];
  fixos_ativos: FixoAtivo[];
  financeiro: {
    receita_mes: number;
    previsto_mes: number;
    pendente: number;
    atrasado: number;
    recebida_90d: number;
  };
}

type Mensagem = { tipo: "ok" | "erro"; texto: string } | null;

/* ------------------------------------------------------------ utilidades */

const CORES_TIPO: Record<TipoReserva, string> = {
  fixo: "bg-petroleo-700",
  avulsa: "bg-salvia-600",
  reposicao: "bg-laranja-500",
};

function SeloTipo({ tipo }: { tipo: string }) {
  const chave = (tipo === "fixo" || tipo === "avulsa" || tipo === "reposicao" ? tipo : "avulsa") as TipoReserva;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold text-white ${CORES_TIPO[chave]}`}>
      {TIPOS_RESERVA[chave].rotulo}
    </span>
  );
}

function rotuloDia(numero: number): string {
  return DIAS_SEMANA.find((d) => d.numero === numero)?.longo ?? String(numero);
}

/* -------------------------------------------------------------- página */

export default function PaginaVisaoGeral() {
  const [dados, setDados] = useState<RespostaDashboard | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<Mensagem>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await fetchAdmin<RespostaDashboard>("/api/admin/dashboard");
      setDados(resposta);
    } catch (e) {
      setErro(mensagemDe(e));
      setMensagem(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const financeiro = dados?.financeiro;
  const atrasado = financeiro?.atrasado ?? 0;

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visão geral</h1>
          <p className="text-sm text-slate-500">
            Resumo do dia, próximas reservas e indicadores financeiros.
          </p>
        </div>
        <button type="button" className="btn-secundario" disabled={carregando} onClick={() => void carregar()}>
          {carregando ? "Atualizando..." : "Atualizar"}
        </button>
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

      {carregando && !dados ? (
        <p role="status" className="card p-6 text-center text-sm text-slate-500">
          Carregando visão geral...
        </p>
      ) : erro && !dados ? (
        <div role="alert" className="card p-6 text-center">
          <p className="font-medium text-red-700">{erro}</p>
          <button type="button" className="btn-secundario mt-4" onClick={() => void carregar()}>
            Tentar novamente
          </button>
        </div>
      ) : dados ? (
        <>
          {erro && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              Não foi possível atualizar os dados ({erro}). Exibindo a última versão carregada.
            </p>
          )}

          <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Indicador
              rotulo="Reservas de hoje"
              valor={String(dados.reservas_do_dia.length)}
              detalhe={dados.rotulo_hoje}
            />
            <Indicador
              rotulo="Solicitações pendentes"
              valor={String(dados.solicitacoes_pendentes.length)}
              tom={dados.solicitacoes_pendentes.length > 0 ? "atencao" : "neutro"}
            />
            <Indicador rotulo="Horários fixos ativos" valor={String(dados.fixos_ativos.length)} />
            <Indicador rotulo="Valores pendentes" valor={formatarMoeda(financeiro?.pendente)} />
            <Indicador
              rotulo="Receita do mês"
              valor={formatarMoeda(financeiro?.receita_mes)}
              detalhe={`Previsto: ${formatarMoeda(financeiro?.previsto_mes)}`}
            />
            <Indicador
              rotulo="Valores em atraso"
              valor={formatarMoeda(atrasado)}
              tom={atrasado > 0 ? "alerta" : "neutro"}
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Reservas do dia */}
            <section aria-label="Reservas do dia" className="card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-semibold text-slate-900">Reservas do dia</h2>
                <span className="text-xs text-slate-500">{dados.rotulo_hoje}</span>
              </div>
              {dados.reservas_do_dia.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma reserva hoje</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {dados.reservas_do_dia.map((o, i) => (
                    <li key={`${o.reserva_id ?? "r"}-${o.recorrencia_id ?? "s"}-${o.data}-${o.inicio}-${i}`} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatarHora(o.inicio, o.fim)} · {o.nome_consultorio}
                        </p>
                        <p className="truncate text-sm text-slate-600">{o.nome_profissional}</p>
                      </div>
                      <SeloTipo tipo={o.tipo} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Próximas reservas */}
            <section aria-label="Próximas reservas" className="card p-4">
              <h2 className="mb-3 font-semibold text-slate-900">Próximas reservas</h2>
              {dados.proximas_reservas.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma reserva nos próximos dias.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {dados.proximas_reservas.map((o, i) => (
                    <li key={`${o.reserva_id ?? "r"}-${o.recorrencia_id ?? "s"}-${o.data}-${o.inicio}-${i}`} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatarDataCurta(o.data)} · {formatarHora(o.inicio, o.fim)}
                        </p>
                        <p className="truncate text-sm text-slate-600">
                          {o.nome_consultorio} · {o.nome_profissional}
                        </p>
                      </div>
                      <SeloTipo tipo={o.tipo} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Solicitações pendentes */}
            <section aria-label="Solicitações pendentes" className="card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-slate-900">Solicitações pendentes</h2>
                <Link href="/admin/solicitacoes" className="btn-secundario">
                  Gerenciar solicitações
                </Link>
              </div>
              {dados.solicitacoes_pendentes.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma solicitação pendente.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {dados.solicitacoes_pendentes.map((s) => (
                    <li key={s.id} className="py-2">
                      <p className="text-sm font-semibold text-slate-900">{s.nome}</p>
                      <p className="text-sm text-slate-600">
                        {s.nome_consultorio} · {formatarDataCurta(s.data)} · {formatarHora(s.inicio)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Horários fixos ativos */}
            <section aria-label="Horários fixos ativos" className="card p-4">
              <h2 className="mb-3 font-semibold text-slate-900">Horários fixos ativos</h2>
              {dados.fixos_ativos.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum horário fixo ativo.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {dados.fixos_ativos.map((f) => (
                    <li key={f.id} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {rotuloDia(f.dia_semana)} · {formatarHora(f.inicio)}
                        </p>
                        <p className="truncate text-sm text-slate-600">
                          {f.nome_consultorio} · {f.nome_profissional}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-petroleo-700 px-2 py-0.5 text-xs font-semibold text-white">
                        {TIPOS_RESERVA.fixo.rotulo}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}
    </main>
  );
}
