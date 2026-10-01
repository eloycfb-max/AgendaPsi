import { WHATSAPP_NUMERO } from "./constants";
import { formatarDataLonga, formatarHora } from "./dates";

export interface SolicitacaoWa {
  nome: string;
  consultorio: string;
  data: string; // YYYY-MM-DD
  inicio: number;
  fim: number;
  tipo: string;
}

/**
 * Monta o link oficial do WhatsApp com mensagem pré-preenchida (RF-034/RF-035).
 * Ex.: https://wa.me/5521987540264?text=...
 */
export function montarLinkWhatsApp(dados: SolicitacaoWa): string {
  const rotuloTipo =
    dados.tipo === "fixo" ? "Horário Fixo" : dados.tipo === "avulsa" ? "Avulso" : "Reposição";
  const mensagem = [
    `Olá! Meu nome é ${dados.nome}.`,
    `Gostaria de solicitar a reserva do ${dados.consultorio}.`,
    `Data: ${formatarDataLonga(dados.data)}`,
    `Horário: ${formatarHora(dados.inicio, dados.fim)}`,
    `Tipo de sublocação: ${rotuloTipo}`,
    "",
    "Aguardo a confirmação da disponibilidade. Obrigado(a)!",
  ].join("\n");
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`;
}
