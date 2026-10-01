"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RequisicaoErro, fetchAdmin, mensagemDe } from "../fetchAdmin";
import { addDias, formatarData, formatarDataCurta, formatarHora, hojeIso, inicioSemana } from "@/lib/dates";
import { GradeAgenda } from "./GradeAgenda";
import { ModalNovaReserva } from "./ModalNovaReserva";
import { ModalDetalhesOcorrencia } from "./ModalDetalhesOcorrencia";
import { ModalNovoFixo } from "./ModalNovoFixo";
import type { OcorrenciaAgenda, RespostaAgenda } from "./tipos";

type Mensagem = { tipo: "ok" | "erro"; texto: string } | null;

const DIAS_JANELA = 7;

/** Tela principal da agenda administrativa (RF-042): grade semanal + ações. */
export function AgendaAdminCliente() {
  const [inicio, setInicio] = useState<string>(() => inicioSemana(hojeIso()));
  const [dados, setDados] = useState<RespostaAgenda | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [consultorioId, setConsultorioId] = useState<number | null>(null);
  const [diaMobile, setDiaMobile] = useState<string>(() => hojeIso());
  const [mensagem, setMensagem] = useState<Mensagem>(null);

  // Modais
  const [novaReserva, setNovaReserva] = useState<{ data: string; hora: number } | null>(null);
  const [detalhes, setDetalhes] = useState<OcorrenciaAgenda | null>(null);
  const [novoFixo, setNovoFixo] = useState(false);

  /* ------------------------------------------------------------ busca */

  const carregar = useCallback(
    async (mostrarCarregando: boolean) => {
      if (mostrarCarregando) setCarregando(true);
      setErro(null);
      try {
        const resposta = await fetchAdmin<RespostaAgenda>(
          `/api/admin/agenda?inicio=${inicio}&dias=${DIAS_JANELA}`
        );
        setDados(resposta);
      } catch (e) {
        if (e instanceof RequisicaoErro && e.status === 401) return; // redirecionando ao login
        setErro(mensagemDe(e));
      } finally {
        if (mostrarCarregando) setCarregando(false);
      }
    },
    [inicio]
  );

  // Busca inicial e ao trocar de semana
  useEffect(() => {
    void carregar(true);
  }, [carregar]);

  // Polling de 10 s + refetch ao voltar o foco para a aba
  useEffect(() => {
    const aoFocar = () => {
      void carregar(false);
    };
    const aoVisibilidade = () => {
      if (document.visibilityState === "visible") void carregar(false);
    };
    const id = window.setInterval(() => void carregar(false), 10000);
    window.addEventListener("focus", aoFocar);
    document.addEventListener("visibilitychange", aoVisibilidade);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", aoFocar);
      document.removeEventListener("visibilitychange", aoVisibilidade);
    };
  }, [carregar]);

  // Consultório selecionado (mantém se ainda existir)
  useEffect(() => {
    if (!dados) return;
    setConsultorioId((atual) => {
      if (atual !== null && dados.consultorios.some((c) => c.id === atual)) return atual;
      return dados.consultorios.length > 0 ? dados.consultorios[0].id : null;
    });
  }, [dados]);

  // Dia da visão mobile sempre dentro da semana atual
  useEffect(() => {
    const hoje = hojeIso();
    const fimSemana = addDias(inicio, 5);
    setDiaMobile(hoje >= inicio && hoje <= fimSemana ? hoje : inicio);
  }, [inicio]);

  /* --------------------------------------------------------- navegação */

  function semanaAnterior() {
    setInicio(addDias(inicio, -DIAS_JANELA));
  }
  function proximaSemana() {
    setInicio(addDias(inicio, DIAS_JANELA));
  }
  function irParaHoje() {
    setInicio(inicioSemana(hojeIso()));
  }

  /* ----------------------------------------------------------- ações */

  function concluiuNovaReserva(texto: string) {
    setMensagem({ tipo: "ok", texto });
    setNovaReserva(null);
    void carregar(false);
  }

  function concluiuDetalhes(texto: string) {
    setMensagem({ tipo: "ok", texto });
    setDetalhes(null);
    void carregar(false);
  }

  function concluiuNovoFixo(texto: string) {
    setMensagem({ tipo: "ok", texto });
    setNovoFixo(false);
    void carregar(false);
  }

  const consultorioAtual = dados?.consultorios.find((c) => c.id === consultorioId) ?? null;
  const semanaVazia = dados !== null && dados.ocorrencias.length === 0 && dados.solicitacoes.length === 0;
  const rotuloSemana = `Semana de ${formatarData(inicio)} a ${formatarData(addDias(inicio, DIAS_JANELA - 1))}`;

  /* --------------------------------------------------------- render */

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agenda</h1>
          <p className="text-sm text-slate-500">
            Grade de segunda a sábado, das 07h às 20h, por consultório.
          </p>
        </div>
        <button
          type="button"
          className="btn-primario"
          disabled={dados === null || dados.consultorios.length === 0}
          onClick={() => setNovoFixo(true)}
        >
          Novo horário fixo
        </button>
      </div>

      {/* Navegação de semanas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secundario"
            aria-label="Semana anterior"
            disabled={carregando && dados === null}
            onClick={semanaAnterior}
          >
            ‹
          </button>
          <button
            type="button"
            className="btn-secundario"
            disabled={carregando && dados === null}
            onClick={irParaHoje}
          >
            Hoje
          </button>
          <button
            type="button"
            className="btn-secundario"
            aria-label="Próxima semana"
            disabled={carregando && dados === null}
            onClick={proximaSemana}
          >
            ›
          </button>
        </div>
        <p className="text-sm font-medium text-slate-600" aria-live="polite">
          {rotuloSemana}
        </p>
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
          Carregando agenda...
        </p>
      ) : erro && !dados ? (
        <div role="alert" className="card p-6 text-center">
          <p className="font-medium text-red-700">{erro}</p>
          <button type="button" className="btn-secundario mt-4" onClick={() => void carregar(true)}>
            Tentar novamente
          </button>
        </div>
      ) : dados ? (
        <>
          {erro && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              Não foi possível atualizar a agenda ({erro}). Último carregamento exibido.
            </p>
          )}

          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="min-w-0 flex-1 space-y-4">
              {/* Abas de consultório */}
              <div className="flex flex-wrap gap-2" role="group" aria-label="Consultórios">
                {dados.consultorios.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={c.id === consultorioId}
                    onClick={() => setConsultorioId(c.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                      c.id === consultorioId
                        ? "border-petroleo-700 bg-petroleo-700 text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {c.nome}
                  </button>
                ))}
              </div>

              {dados.consultorios.length === 0 ? (
                <p className="card p-6 text-center text-sm text-slate-500">
                  Nenhum consultório cadastrado.
                </p>
              ) : consultorioId === null ? (
                <p role="status" className="card p-6 text-center text-sm text-slate-500">
                  Selecionando consultório...
                </p>
              ) : (
                <>
                  {semanaVazia && (
                    <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                      Nenhuma reserva nesta semana.
                    </p>
                  )}
                  <GradeAgenda
                    dados={dados}
                    consultorioId={consultorioId}
                    diaMobile={diaMobile}
                    aoSelecionarDia={setDiaMobile}
                    aoAbrirOcorrencia={setDetalhes}
                    aoNovaReserva={(data, hora) => {
                      setMensagem(null);
                      setNovaReserva({ data, hora });
                    }}
                  />
                </>
              )}
            </div>

            {/* Painel lateral (desktop) / abaixo (mobile) */}
            <aside aria-label="Solicitações pendentes na semana" className="w-full shrink-0 lg:w-80">
              <div className="card space-y-3 p-4">
                <h2 className="font-semibold text-slate-900">Solicitações pendentes na semana</h2>
                {dados.solicitacoes.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma solicitação pendente nesta semana.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {dados.solicitacoes.map((s) => (
                      <li key={s.id} className="py-2">
                        <p className="text-sm font-semibold text-slate-900">{s.nome}</p>
                        <p className="text-sm text-slate-600">
                          {s.nome_consultorio} · {formatarDataCurta(s.data)} · {formatarHora(s.inicio)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/admin/solicitacoes" className="btn-secundario w-full">
                  Ir para solicitações
                </Link>
              </div>
            </aside>
          </div>
        </>
      ) : null}

      {/* Modais ---------------------------------------------------------- */}
      {novaReserva && consultorioAtual && (
        <ModalNovaReserva
          aberto
          aoFechar={() => setNovaReserva(null)}
          data={novaReserva.data}
          hora={novaReserva.hora}
          consultorioId={consultorioAtual.id}
          consultorioNome={consultorioAtual.nome}
          aoConcluir={concluiuNovaReserva}
          aoConflito={() => void carregar(false)}
        />
      )}

      <ModalDetalhesOcorrencia
        aberto={detalhes !== null}
        ocorrencia={detalhes}
        consultorioNome={consultorioAtual?.nome ?? ""}
        aoFechar={() => setDetalhes(null)}
        aoConcluir={concluiuDetalhes}
      />

      {dados && (
        <ModalNovoFixo
          aberto={novoFixo}
          aoFechar={() => setNovoFixo(false)}
          consultorios={dados.consultorios}
          aoConcluir={concluiuNovoFixo}
        />
      )}
    </main>
  );
}
