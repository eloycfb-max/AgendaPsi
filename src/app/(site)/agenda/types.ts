/**
 * Tipos compartilhados da agenda pública.
 * Contrato de GET /api/public/availability (docs/API.md) — sem nomes de
 * profissionais, telefones ou valores (RF-016).
 */

export type StatusSlot = "livre" | "ocupado" | "bloqueado";

export interface HorarioAPI {
  hora: number;
  status: StatusSlot;
}

export interface DiaAPI {
  data: string; // YYYY-MM-DD
  dow: number; // 0 = domingo ... 6 = sábado
  rotulo: string;
  domingo: boolean;
  horarios: HorarioAPI[];
}

export interface ConsultorioAPI {
  id: number;
  nome: string;
  slug: string;
  dias: DiaAPI[];
}

export interface DisponibilidadeAPI {
  inicio: string;
  fim: string;
  consultorios: ConsultorioAPI[];
}

/** Horário clicado pelo visitante — base do POST /api/public/solicitacoes. */
export interface SlotSelecionado {
  consultorioId: number;
  consultorioNome: string;
  data: string; // YYYY-MM-DD
  hora: number; // início do bloco (hora cheia)
}
