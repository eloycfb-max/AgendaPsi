"use client";

import { useMemo } from "react";
import { horariosValidos } from "@/lib/constants";
import { ehHoje, formatarDataCurta, formatarHora } from "@/lib/dates";
import { Slot } from "./Slot";
import type { DiaAPI, StatusSlot } from "./types";

interface GradeSemanaProps {
  consultorioNome: string;
  /** Dias úteis da janela (seg–sáb; domingo já excluído). */
  dias: DiaAPI[];
  somenteLivres: boolean;
  aoSelecionar: (dia: DiaAPI, hora: number) => void;
}

/**
 * Grade semanal Seg–Sáb × 07h–20h (RF-011/RF-012), visão padrão em telas md+.
 * Não exibe domingo e nunca revela quem ocupa o horário (RF-016).
 */
export function GradeSemana({ consultorioNome, dias, somenteLivres, aoSelecionar }: GradeSemanaProps) {
  const horas = useMemo(() => horariosValidos(), []);
  const colunas = useMemo(
    () =>
      dias.map((dia) => ({
        dia,
        porHora: new Map<number, StatusSlot>(
          dia.horarios.map((h) => [h.hora, h.status] as [number, StatusSlot])
        ),
      })),
    [dias]
  );

  return (
    <div className="card hidden overflow-x-auto p-2 sm:p-4 md:block">
      <table className="w-full min-w-[36rem] border-collapse text-left">
        <caption className="sr-only">
          Grade semanal de {consultorioNome}: horários de segunda a sábado, blocos de 1 hora das
          07:00 às 21:00.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-16 border-b border-slate-200 p-2 text-xs font-semibold text-slate-400 sm:w-20">
              Hora
            </th>
            {colunas.map(({ dia }) => {
              const hoje = ehHoje(dia.data);
              return (
                <th
                  key={dia.data}
                  scope="col"
                  className={`border-b p-2 text-center text-xs font-semibold ${
                    hoje
                      ? "border-petroleo-200 bg-petroleo-50 text-petroleo-800"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  <span className="block">{formatarDataCurta(dia.data)}</span>
                  {hoje && <span className="mt-0.5 block text-[10px] font-medium uppercase text-petroleo-600">hoje</span>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {horas.map((hora) => (
            <tr key={hora}>
              <th
                scope="row"
                className="border-b border-slate-100 p-2 text-right align-middle text-xs font-semibold text-slate-500"
              >
                {formatarHora(hora)}
              </th>
              {colunas.map(({ dia, porHora }) => (
                <td key={dia.data} className="border-b border-slate-100 p-1">
                  <Slot
                    consultorioNome={consultorioNome}
                    dataIso={dia.data}
                    hora={hora}
                    status={porHora.get(hora) ?? "bloqueado"}
                    somenteLivres={somenteLivres}
                    aoSelecionar={() => aoSelecionar(dia, hora)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
