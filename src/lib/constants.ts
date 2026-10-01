/**
 * Constantes de domínio do HumanaMentePsi.
 * Grade: 07h às 21h (último bloco 20h–21h), segunda a sábado.
 */

export const HORARIO_INICIO = 7;
export const HORARIO_FIM = 21; // último bloco começa às 20h

/** 1 = segunda-feira ... 6 = sábado (domingo bloqueado) */
export const DIAS_SEMANA = [
  { numero: 1, curto: "Seg", longo: "Segunda-feira" },
  { numero: 2, curto: "Ter", longo: "Terça-feira" },
  { numero: 3, curto: "Qua", longo: "Quarta-feira" },
  { numero: 4, curto: "Qui", longo: "Quinta-feira" },
  { numero: 5, curto: "Sex", longo: "Sexta-feira" },
  { numero: 6, curto: "Sáb", longo: "Sábado" },
] as const;

export const TIPOS_RESERVA = {
  fixo: { rotulo: "Horário Fixo", cor: "var(--color-petroleo-700)" },
  avulsa: { rotulo: "Avulso", cor: "var(--color-salvia-600)" },
  reposicao: { rotulo: "Reposição", cor: "var(--color-laranja-500)" },
} as const;

export type TipoReserva = keyof typeof TIPOS_RESERVA;

export const SITUACOES_FINANCEIRAS = {
  pendente: "Pendente",
  pago: "Pago",
  parcial: "Parcialmente pago",
  atrasado: "Em atraso",
  cancelado: "Cancelado",
} as const;

export type SituacaoFinanceira = keyof typeof SITUACOES_FINANCEIRAS;

export const FORMAS_PAGAMENTO = [
  "Pix",
  "Dinheiro",
  "Transferência",
  "Cartão de débito",
  "Cartão de crédito",
  "Outro",
] as const;

/** Número oficial de WhatsApp do administrador (PRD RF-035) */
export const WHATSAPP_NUMERO = "5521987540264";
export const WHATSAPP_EXIBICAO = "+55 21 98754-0264";

export const ENDERECO = {
  rua: "Avenida das Américas, 1155",
  bairro: "Barra da Tijuca",
  cidade: "Rio de Janeiro",
  uf: "RJ",
  cep: "22631-004",
  googleMaps: "https://www.google.com/maps/search/?api=1&query=Avenida+das+Am%C3%A9ricas,+1155,+Barra+da+Tijuca,+Rio+de+Janeiro",
  link: "https://maps.app.goo.gl/", // complemento opcional
};

/** Horários válidos da grade (início de cada bloco de 1 hora) */
export function horariosValidos(): number[] {
  const lista: number[] = [];
  for (let h = HORARIO_INICIO; h < HORARIO_FIM; h++) lista.push(h);
  return lista;
}

export function ehHoraValida(hora: number): boolean {
  return Number.isInteger(hora) && hora >= HORARIO_INICIO && hora < HORARIO_FIM;
}

/** 1=segunda ... 6=sábado; domingo = 0 */
export function diaSemanaIso(dataIso: string): number {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const dow = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
  return dow;
}
