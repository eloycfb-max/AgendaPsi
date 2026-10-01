"use client";

import { useMemo } from "react";
import { DIAS_SEMANA, horariosValidos } from "@/lib/constants";
import { formatarData, formatarDataLonga, formatarHora } from "@/lib/dates";
import { Slot } from "./Slot";
import type { DiaAPI, StatusSlot } from "./types";

interface ListaDiaProps {
  consultorioNome: string;
  /** Dias úteis da janela (seg–sáb; domingo já excluído). */
  dias: DiaAPI[];
  diaSelecionado: string | null;
  aoSelecionarDia: (data: string) => void;
  somenteLivres: boolean;
  aoSelecionar: (dia: DiaAPI, hora: number) => void;
}

/**
 * Visão dia a dia do celular (RF 7.2): chips de dia Seg..Sáb roláveis e
 * lista vertical dos 14 horários — sem rolagem horizontal da grade.
 */
export function ListaDia({
  consultorioNome,
  dias,
  diaSelecionado,
  aoSelecionarDia,
  somenteLivres,
  aoSelecionar,
}: ListaDiaProps) {
  const horas = useMemo(() => horariosValidos(), []);

  const dia = useMemo(
    () => dias.find((d) => d.data === diaSelecionado) ?? dias[0] ?? null,
    [dias, diaSelecionado]
  );

  const porHora = useMemo(() => {
    const mapa = new Map<number, StatusSlot>();
    if (dia) for (const h of dia.horarios) mapa.set(h.hora, h.status);
    return mapa;
  }, [dia]);

  if (!dia) return null;

  return (
    <section
      aria-label={`Horários por dia — ${consultorioNome}`}
      className="card p-3 md:hidden sm:p-4"
    >
      {/* Chips de dia (roláveis horizontalmente) */}
      <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Escolha o dia">
        {dias.map((d) => {
          const ativo = d.data === dia.data;
          const curto = DIAS_SEMANA.find((x) => x.numero === d.dow)?.curto ?? "Dia";
          return (
            <li key={d.data}>
              <button
                type="button"
                onClick={() => aoSelecionarDia(d.data)}
                aria-pressed={ativo}
                aria-label={formatarDataLonga(d.data)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-center transition-colors ${
                  ativo
                    ? "border-petroleo-700 bg-petroleo-700 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:border-petroleo-400 hover:bg-petroleo-50"
                }`}
              >
                <span className="block text-xs font-semibold">{curto}</span>
                <span className={`block text-[11px] ${ativo ? "text-petroleo-100" : "text-slate-500"}`}>
                  {formatarData(d.data)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-sm font-bold text-petroleo-800">{formatarDataLonga(dia.data)}</p>
      <p className="text-xs text-slate-500">
        {consultorioNome} · blocos de 1 hora, das 07:00 às 21:00
      </p>

      <ul className="mt-3 space-y-2">
        {horas.map((hora) => (
          <li key={hora}>
            <Slot
              consultorioNome={consultorioNome}
              dataIso={dia.data}
              hora={hora}
              status={porHora.get(hora) ?? "bloqueado"}
              somenteLivres={somenteLivres}
              rotuloHora={formatarHora(hora, hora + 1)}
              aoSelecionar={() => aoSelecionar(dia, hora)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
