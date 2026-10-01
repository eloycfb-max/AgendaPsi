"use client";

import { formatarDataLonga, formatarHora } from "@/lib/dates";
import type { StatusSlot } from "./types";

interface SlotProps {
  consultorioNome: string;
  dataIso: string;
  hora: number;
  status: StatusSlot;
  /** Quando true, horários não livres aparecem esmaecidos (filtro RF-014). */
  somenteLivres: boolean;
  /** Exibe o período ao lado do status (visão dia a dia do celular). */
  rotuloHora?: string;
  aoSelecionar: () => void;
}

/**
 * Célula da agenda (RF-011/RF-016): clicável somente quando "livre";
 * ocupada mostra apenas o rótulo "Ocupado" — nunca nome, telefone ou valor.
 * Todas as células são <button> com aria-label descritivo (acessibilidade).
 */
export function Slot({
  consultorioNome,
  dataIso,
  hora,
  status,
  somenteLivres,
  rotuloHora,
  aoSelecionar,
}: SlotProps) {
  const periodo = formatarHora(hora, hora + 1);
  const contexto = `${consultorioNome}, ${formatarDataLonga(dataIso)}, ${periodo}`;
  const alinhamento = rotuloHora ? "justify-between gap-3 px-3" : "justify-center";

  // Filtro "somente horários livres": esconde o detalhe do horário ocupado.
  if (status !== "livre" && somenteLivres) {
    return (
      <div
        aria-hidden="true"
        className={`slot w-full border-slate-100 bg-slate-50 text-slate-300 ${alinhamento}`}
      >
        {rotuloHora && <span>{rotuloHora}</span>}
        <span>—</span>
      </div>
    );
  }

  if (status === "livre") {
    return (
      <button
        type="button"
        onClick={aoSelecionar}
        aria-label={`Solicitar horário livre: ${contexto}`}
        className={`slot slot-livre w-full ${alinhamento}`}
      >
        {rotuloHora && <span>{rotuloHora}</span>}
        <span>Livre</span>
      </button>
    );
  }

  const rotulo = status === "ocupado" ? "Ocupado" : "Indisponível";
  const descricao =
    status === "ocupado" ? `Horário ocupado: ${contexto}` : `Horário indisponível: ${contexto}`;

  return (
    <button
      type="button"
      disabled
      aria-label={descricao}
      className={`slot w-full ${
        status === "ocupado"
          ? "slot-ocupado"
          : "border-dashed border-slate-300 bg-slate-100 text-slate-400"
      } ${alinhamento}`}
    >
      {rotuloHora && <span>{rotuloHora}</span>}
      <span>{rotulo}</span>
    </button>
  );
}
