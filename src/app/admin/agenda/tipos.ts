/**
 * Tipos e utilitários compartilhados da tela de agenda administrativa.
 * Espelham o contrato de GET /api/admin/agenda (docs/API.md).
 */
import type { TipoReserva } from "@/lib/constants";

export interface ConsultorioAgenda {
  id: number;
  nome: string;
  slug: string;
}

export interface OcorrenciaAgenda {
  consultorio_id: number;
  data: string;
  inicio: number;
  fim: number;
  tipo: TipoReserva;
  reserva_id: number | null;
  recorrencia_id: number | null;
  profissional_id: number;
  nome_profissional: string;
  valor_acordado: number | null;
  observacoes: string | null;
}

export interface SolicitacaoAgenda {
  id: number;
  nome: string;
  telefone: string;
  consultorio_id: number;
  nome_consultorio: string;
  data: string;
  inicio: number;
  fim: number;
  tipo: string;
  situacao: string;
  created_at: string;
}

export interface RecorrenciaAgenda {
  id: number;
  dia_semana: number;
  inicio: number;
  data_inicio: string;
  data_fim: string | null;
  nome_consultorio: string;
  nome_profissional: string;
}

export interface RespostaAgenda {
  inicio: string;
  fim: string;
  consultorios: ConsultorioAgenda[];
  ocorrencias: OcorrenciaAgenda[];
  solicitacoes: SolicitacaoAgenda[];
  recorrencias: RecorrenciaAgenda[];
}

export interface ProfissionalAgenda {
  id: number;
  nome: string;
  profissao: string;
  telefone: string;
  email: string | null;
  situacao: string;
  observacoes: string | null;
}

/** Conteúdo de uma célula da grade: o que existe em data+hora+consultório. */
export interface CelulaAgenda {
  ocorrencia: OcorrenciaAgenda | null;
  solicitacao: SolicitacaoAgenda | null;
}

/** Classe CSS de fundo do tipo de reserva. */
export function classeSlot(tipo: TipoReserva): string {
  if (tipo === "fixo") return "slot slot-fixo";
  if (tipo === "avulsa") return "slot slot-avulso";
  return "slot slot-reposicao";
}

/** Localiza ocorrência e solicitação pendente de uma célula. */
export function celulaPara(
  dados: RespostaAgenda,
  consultorioId: number,
  data: string,
  hora: number
): CelulaAgenda {
  const ocorrencia =
    dados.ocorrencias.find(
      (o) => o.consultorio_id === consultorioId && o.data === data && o.inicio === hora
    ) ?? null;
  const solicitacao =
    dados.solicitacoes.find(
      (s) => s.consultorio_id === consultorioId && s.data === data && s.inicio === hora
    ) ?? null;
  return { ocorrencia, solicitacao };
}
