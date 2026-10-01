import type { Metadata } from "next";
import { AgendaCliente } from "./AgendaCliente";

/**
 * Página pública da agenda (MOD-02 / RF-006 a RF-016).
 * Server component apenas para os metadados; agrade é cliente puro.
 */
export const metadata: Metadata = {
  // title.absolute contorna o template "%s | HumanaMentePsi" do layout raiz.
  title: { absolute: "Agenda — HumanaMentePsi" },
  description:
    "Consulte em tempo real os horários livres dos três consultórios do HumanaMentePsi, na Barra da Tijuca, e solicite o seu horário pelo WhatsApp.",
};

export default function PaginaAgenda() {
  return <AgendaCliente />;
}
