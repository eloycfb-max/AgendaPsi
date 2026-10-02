"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TIPOS_RESERVA, type TipoReserva } from "@/lib/constants";
import { addDias, formatarData, hojeIso, inicioSemana } from "@/lib/dates";
import { GradeSemana } from "./GradeSemana";
import { ListaDia } from "./ListaDia";
import { ModalSolicitacao } from "./ModalSolicitacao";
import type { DiaAPI, DisponibilidadeAPI, SlotSelecionado } from "./types";

type EstadoAgenda = "carregando" | "pronto" | "erro";

const DIAS_JANELA = 7;
const TIPOS = Object.keys(TIPOS_RESERVA) as TipoReserva[];

/**
 * Agenda pública (RF-005 a RF-016, RF-027, RF-033 a RF-038).
 * Busca GET /api/public/availability, atualiza por polling de 10 s e ao focar
 * a janela, e jamais mostra sucesso sem a resposta do servidor.
 */
export function AgendaCliente() {
  const [estado, setEstado] = useState<EstadoAgenda>("carregando");
  const [dados, setDados] = useState<DisponibilidadeAPI | null>(null);
  const [falhaAtualizacao, setFalhaAtualizacao] = useState(false);
  const [inicio, setInicio] = useState<string>(() => inicioSemana(hojeIso()));
  const [consultorioId, setConsultorioId] = useState<number | null>(null);
  const [tipo, setTipo] = useState<TipoReserva>("avulsa");
  const [somenteLivres, setSomenteLivres] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotSelecionado | null>(null);
  const [copiado, setCopiado] = useState(false);

  const seqRef = useRef(0); // descarta respostas obsoletas (mudou a semana)
  const dadosRef = useRef<DisponibilidadeAPI | null>(null);

  const carregar = useCallback(
    async (silencioso: boolean) => {
      const seq = ++seqRef.current;
      if (!silencioso) setEstado("carregando");
      try {
        const resposta = await fetch(
          `/api/public/availability?inicio=${encodeURIComponent(inicio)}&dias=${DIAS_JANELA}`,
          { cache: "no-store" }
        );
        if (!resposta.ok) throw new Error("Resposta inválida da API.");
        const json = (await resposta.json()) as DisponibilidadeAPI | null;
        if (!json || !Array.isArray(json.consultorios)) throw new Error("Payload inválido.");
        if (seq !== seqRef.current) return; // resposta obsoleta
        dadosRef.current = json;
        setDados(json);
        setFalhaAtualizacao(false);
        setEstado("pronto");
      } catch {
        if (seq !== seqRef.current) return;
        // Polling falhou mas há dados anteriores: mantém a grade e avisa.
        if (silencioso && dadosRef.current) {
          setFalhaAtualizacao(true);
          return;
        }
        dadosRef.current = null;
        setDados(null);
        setFalhaAtualizacao(false);
        setEstado("erro");
      }
    },
    [inicio]
  );

  // Carga inicial e recarga ao trocar de semana.
  useEffect(() => {
    void carregar(false);
  }, [carregar]);

  // RF-015: polling de 10 s + refetch ao focar/visitar a aba.
  useEffect(() => {
    const intervalo = window.setInterval(() => void carregar(true), 10000);
    const aoFocar = () => {
      if (document.visibilityState === "visible") void carregar(true);
    };
    window.addEventListener("focus", aoFocar);
    document.addEventListener("visibilitychange", aoFocar);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("focus", aoFocar);
      document.removeEventListener("visibilitychange", aoFocar);
    };
  }, [carregar]);

  const consultorios = dados?.consultorios ?? [];
  const consultorio =
    (consultorioId !== null ? consultorios.find((c) => c.id === consultorioId) : undefined) ??
    consultorios[0] ??
    null;

  // Padrão: primeiro consultório da lista (RF-014).
  useEffect(() => {
    if (consultorios.length === 0) return;
    const atual = consultorioId !== null && consultorios.some((c) => c.id === consultorioId);
    if (!atual) setConsultorioId(consultorios[0].id);
  }, [consultorios, consultorioId]);

  // Dias exibidos: segunda a sábado (domingo nunca aparece — CA-002).
  const diasSemana = useMemo<DiaAPI[]>(() => {
    if (!consultorio) return [];
    return consultorio.dias
      .filter((d) => !d.domingo && d.dow >= 1 && d.dow <= 6)
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [consultorio]);

  // Padrão da visão celular: hoje (se estiver na semana) ou o primeiro dia.
  useEffect(() => {
    if (diasSemana.length === 0) return;
    if (diaSelecionado && diasSemana.some((d) => d.data === diaSelecionado)) return;
    const hoje = hojeIso();
    setDiaSelecionado(diasSemana.some((d) => d.data === hoje) ? hoje : diasSemana[0].data);
  }, [diasSemana, diaSelecionado]);

  const livresSemana = useMemo(() => {
    if (!consultorio) return 0;
    let total = 0;
    for (const dia of consultorio.dias) {
      if (dia.domingo) continue;
      for (const h of dia.horarios) if (h.status === "livre") total++;
    }
    return total;
  }, [consultorio]);

  const selecionarSlot = useCallback(
    (dia: DiaAPI, hora: number) => {
      if (!consultorio) return;
      setSlot({
        consultorioId: consultorio.id,
        consultorioNome: consultorio.nome,
        data: dia.data,
        hora,
      });
    },
    [consultorio]
  );

  const copiarLink = useCallback(async () => {
    const link = `${window.location.origin}/agenda`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Fallback quando a API de área de transferência não está disponível.
      window.prompt("Copie o link da agenda:", link);
    }
  }, []);

  return (
    <div className="bg-slate-50 py-10 sm:py-14">
      <div className="mx-auto max-w-6xl px-4">
        {/* Cabeçalho + compartilhamento (RF-005) */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-salvia-600">
              Barra da Tijuca · 3 consultórios
            </p>
            <h1 id="agenda-titulo" className="mt-1 text-2xl font-bold text-petroleo-800 sm:text-3xl">
              Agenda em tempo real
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Consulte os horários livres de segunda a sábado, das 07h às 21h, e envie a sua
              solicitação. A confirmação é sempre feita pelo administrador, pelo WhatsApp.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              A agenda é atualizada automaticamente a cada 10 segundos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void copiarLink()}
            aria-live="polite"
            className="btn-secundario self-start shrink-0"
            title="Copiar o link público da agenda"
          >
            {copiado ? "Link copiado!" : "Copiar link da agenda"}
          </button>
        </div>

        {/* Navegação de semanas (RF-013) */}
        <nav
          aria-label="Navegação de semanas"
          className="card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setInicio((atual) => addDias(atual, -DIAS_JANELA))}
              className="btn-secundario"
              aria-label="Ver a semana anterior"
            >
              ‹ Semana anterior
            </button>
            <button
              type="button"
              onClick={() => setInicio(inicioSemana(hojeIso()))}
              className="btn-secundario"
              aria-label="Ir para a semana atual"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setInicio((atual) => addDias(atual, DIAS_JANELA))}
              className="btn-secundario"
              aria-label="Ver a próxima semana"
            >
              Próxima semana ›
            </button>
          </div>
          <p aria-live="polite" className="text-sm font-bold text-petroleo-800">
            {/* Janela visível: segunda a sábado (domingo não aparece — CA-002). */}
            {formatarData(inicio)} – {formatarData(addDias(inicio, DIAS_JANELA - 2))}
          </p>
        </nav>

        {/* Filtros (RF-014) */}
        <section aria-labelledby="filtros-titulo" className="card mt-4 p-4">
          <h2 id="filtros-titulo" className="text-sm font-bold text-petroleo-800">
            Filtros
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="rotulo" htmlFor="filtro-consultorio">
                Consultório
              </label>
              <select
                id="filtro-consultorio"
                className="campo"
                value={consultorio ? String(consultorio.id) : ""}
                onChange={(e) => setConsultorioId(Number(e.target.value))}
                disabled={consultorios.length === 0}
              >
                {consultorios.length === 0 && (
                  <option value="">{estado === "erro" ? "Indisponível" : "Carregando…"}</option>
                )}
                {consultorios.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="rotulo" htmlFor="filtro-tipo">
                Tipo de sublocação
              </label>
              <select
                id="filtro-tipo"
                className="campo"
                value={tipo}
                onChange={(e) => {
                  const valor = e.target.value;
                  if (TIPOS.includes(valor as TipoReserva)) setTipo(valor as TipoReserva);
                }}
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {TIPOS_RESERVA[t].rotulo}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Usado na solicitação; não altera a grade.
              </p>
            </div>

            <div>
              <span className="rotulo" id="rotulo-disponibilidade">
                Disponibilidade
              </span>
              <label
                htmlFor="filtro-livres"
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  somenteLivres
                    ? "border-petroleo-600 bg-petroleo-50 font-semibold text-petroleo-800"
                    : "border-slate-300 bg-white text-slate-700 hover:border-petroleo-400"
                }`}
                aria-describedby="rotulo-disponibilidade"
              >
                <input
                  id="filtro-livres"
                  type="checkbox"
                  checked={somenteLivres}
                  onChange={(e) => setSomenteLivres(e.target.checked)}
                  className="h-4 w-4 accent-petroleo-700"
                />
                Somente horários livres
              </label>
            </div>
          </div>
        </section>

        {/* Legenda (RF-027) */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
          <span className="font-bold text-slate-700">Legenda:</span>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-3.5 w-3.5 rounded-sm border border-slate-300 bg-white" />
            Disponível
          </span>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-3.5 w-3.5 rounded-sm bg-petroleo-700" />
            Ocupado
          </span>
          <span className="text-slate-500">
            As cores de tipo (horário fixo, avulso, reposição e pendente) ficam reservadas ao painel
            administrativo.
          </span>
        </div>

        {/* Carregando */}
        {estado === "carregando" && (
          <div role="status" aria-busy="true" className="mt-6">
            <div className="card animate-pulse p-4" aria-hidden="true">
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 42 }, (_, i) => (
                  <div key={i} className="h-11 rounded-md bg-slate-100" />
                ))}
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-500">Carregando agenda…</p>
          </div>
        )}

        {/* Erro de conexão */}
        {estado === "erro" && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-laranja-300 bg-laranja-100 p-6 sm:flex sm:items-center sm:justify-between sm:gap-6"
          >
            <div>
              <p className="font-semibold text-slate-900">Não foi possível carregar a agenda.</p>
              <p className="mt-1 text-sm text-slate-700">
                Confira sua conexão com a internet — a agenda refaz a busca sozinha a cada 10
                segundos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void carregar(false)}
              className="btn-secundario mt-4 shrink-0 sm:mt-0"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Pronto */}
        {estado === "pronto" && (
          <>
            {falhaAtualizacao && (
              <div
                role="alert"
                className="mt-4 flex flex-col gap-2 rounded-lg border border-laranja-300 bg-laranja-100 px-4 py-3 text-sm text-slate-800 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <p>
                  Não foi possível atualizar a agenda em tempo real. Os horários exibidos podem estar
                  desatualizados.
                </p>
                <button
                  type="button"
                  onClick={() => void carregar(true)}
                  className="btn-secundario shrink-0 self-start"
                >
                  Atualizar agora
                </button>
              </div>
            )}

            {!consultorio || diasSemana.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <p className="font-semibold text-slate-800">
                  Nenhum consultório disponível no momento.
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Fale com a gente pelo WhatsApp para saber as datas de liberação.
                </p>
              </div>
            ) : livresSemana === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <p className="font-semibold text-slate-800">
                  Nenhum horário disponível nesta semana
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Todos os horários de {consultorio.nome} já estão ocupados. Consulte a próxima
                  semana ou escolha outro consultório.
                </p>
                <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setInicio((atual) => addDias(atual, DIAS_JANELA))}
                    className="btn-primario"
                  >
                    Ver próxima semana
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {/* Grade semanal (md+) */}
                <GradeSemana
                  consultorioNome={consultorio.nome}
                  dias={diasSemana}
                  somenteLivres={somenteLivres}
                  aoSelecionar={selecionarSlot}
                />
                {/* Visão dia a dia (mobile) */}
                <ListaDia
                  consultorioNome={consultorio.nome}
                  dias={diasSemana}
                  diaSelecionado={diaSelecionado}
                  aoSelecionarDia={setDiaSelecionado}
                  somenteLivres={somenteLivres}
                  aoSelecionar={selecionarSlot}
                />
                <p className="text-xs text-slate-500">
                  Solicitar um horário não reserva-o: a confirmação é feita pelo administrador.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Solicitação (RF-033 a RF-038) */}
      <ModalSolicitacao slot={slot} tipoInicial={tipo} aoFechar={() => setSlot(null)} />
    </div>
  );
}
