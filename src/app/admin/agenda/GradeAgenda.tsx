"use client";

import { addDias, ehHoje, formatarData, formatarDataCurta, formatarHora, formatarMoeda } from "@/lib/dates";
import { TIPOS_RESERVA } from "@/lib/constants";
import { celulaPara, classeSlot, type OcorrenciaAgenda, type RespostaAgenda } from "./tipos";

/* --------------------------------------------------------------- célula */

interface CelulaProps {
  dados: RespostaAgenda;
  consultorioId: number;
  data: string;
  hora: number;
  aoAbrirOcorrencia: (ocorrencia: OcorrenciaAgenda) => void;
  aoNovaReserva: (data: string, hora: number) => void;
}

function Celula({ dados, consultorioId, data, hora, aoAbrirOcorrencia, aoNovaReserva }: CelulaProps) {
  const { ocorrencia, solicitacao } = celulaPara(dados, consultorioId, data, hora);
  const rotuloData = `${formatarData(data)} às ${formatarHora(hora)}`;

  if (ocorrencia) {
    const temPendente = solicitacao !== null;
    const rotulo =
      `${TIPOS_RESERVA[ocorrencia.tipo].rotulo} com ${ocorrencia.nome_profissional}, ` +
      `${rotuloData}` +
      (ocorrencia.valor_acordado !== null ? `, ${formatarMoeda(ocorrencia.valor_acordado)}` : "") +
      (temPendente ? ". Existe também uma solicitação pendente neste horário." : ". Abrir detalhes.");

    return (
      <button
        type="button"
        className={`${classeSlot(ocorrencia.tipo)} relative w-full px-1 py-1`}
        // As classes .slot-* fixam cursor:not-allowed; o inline garante cursor de clique
        style={{ cursor: "pointer" }}
        title={rotulo}
        aria-label={rotulo}
        onClick={() => aoAbrirOcorrencia(ocorrencia)}
      >
        <span className="flex flex-col items-center gap-0.5 text-center leading-tight">
          <span className="break-words text-[11px] font-semibold">{ocorrencia.nome_profissional}</span>
          {ocorrencia.valor_acordado !== null && (
            <span className="text-[10px] font-normal opacity-90">{formatarMoeda(ocorrencia.valor_acordado)}</span>
          )}
        </span>
        {temPendente && (
          <span
            className="absolute -right-1 -top-1 rounded-full border border-amarelo-700 bg-amarelo-300 px-1.5 py-px text-[9px] font-bold text-slate-900"
            aria-hidden="true"
          >
            Pendente
          </span>
        )}
      </button>
    );
  }

  if (solicitacao) {
    const rotulo = `Solicitação pendente de ${solicitacao.nome}, ${rotuloData}. Confirme em Solicitações.`;
    return (
      <div className="slot slot-pendente w-full px-1" role="img" title={rotulo} aria-label={rotulo}>
        <span className="flex flex-col items-center text-center leading-tight">
          <span className="text-[11px] font-bold">Pendente</span>
          <span className="truncate text-[10px] font-normal">{solicitacao.nome}</span>
        </span>
      </div>
    );
  }

  const rotuloLivre = `Horário livre em ${rotuloData}. Criar nova reserva.`;
  return (
    <button
      type="button"
      className="slot slot-livre w-full"
      title={rotuloLivre}
      aria-label={rotuloLivre}
      onClick={() => aoNovaReserva(data, hora)}
    >
      Livre
    </button>
  );
}

/* --------------------------------------------------------------- grade */

export interface GradeAgendaProps {
  dados: RespostaAgenda;
  consultorioId: number;
  diaMobile: string;
  aoSelecionarDia: (data: string) => void;
  aoAbrirOcorrencia: (ocorrencia: OcorrenciaAgenda) => void;
  aoNovaReserva: (data: string, hora: number) => void;
}

/** Grade Seg–Sáb × 07h–20h (desktop) e visão dia a dia (mobile). */
export function GradeAgenda({
  dados,
  consultorioId,
  diaMobile,
  aoSelecionarDia,
  aoAbrirOcorrencia,
  aoNovaReserva,
}: GradeAgendaProps) {
  // Semana de segunda a sábado (a API recebe inicio = segunda-feira)
  const dias = Array.from({ length: 6 }, (_, i) => addDias(dados.inicio, i));
  const horas = Array.from({ length: 14 }, (_, i) => i + 7); // 07..20

  const propsCelula = { dados, consultorioId, aoAbrirOcorrencia, aoNovaReserva };

  return (
    <>
      {/* Desktop: grade da semana inteira */}
      <div className="card hidden overflow-hidden lg:block">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">Grade da semana de {formatarData(dados.inicio)} a {formatarData(dados.fim)}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-20 border border-slate-200 bg-slate-50 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Hora
              </th>
              {dias.map((d) => (
                <th
                  key={d}
                  scope="col"
                  className={`border border-slate-200 px-2 py-2 text-center text-xs font-semibold ${
                    ehHoje(d) ? "bg-petroleo-50 text-petroleo-800" : "bg-slate-50 text-slate-600"
                  }`}
                >
                  {formatarDataCurta(d)}
                  {ehHoje(d) && <span className="ml-1 rounded bg-petroleo-700 px-1.5 py-0.5 text-[10px] text-white">Hoje</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {horas.map((hora) => (
              <tr key={hora}>
                <th
                  scope="row"
                  className="border border-slate-200 bg-slate-50 px-2 py-1 text-right align-top text-xs font-semibold text-slate-600"
                >
                  {formatarHora(hora)}
                </th>
                {dias.map((d) => (
                  <td key={d} className="border border-slate-200 p-1 align-top">
                    <Celula {...propsCelula} data={d} hora={hora} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: um dia por vez, sem rolagem horizontal */}
      <div className="card p-3 lg:hidden">
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Selecionar dia da semana">
          {dias.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={d === diaMobile}
              onClick={() => aoSelecionarDia(d)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                d === diaMobile
                  ? "border-petroleo-700 bg-petroleo-700 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {formatarDataCurta(d)}
              {ehHoje(d) && <span className="sr-only"> (hoje)</span>}
            </button>
          ))}
        </div>

        <ul className="space-y-1.5">
          {horas.map((hora) => (
            <li key={hora} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-right text-xs font-semibold text-slate-500">
                {formatarHora(hora)}
              </span>
              <span className="min-w-0 flex-1">
                <Celula {...propsCelula} data={diaMobile} hora={hora} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
