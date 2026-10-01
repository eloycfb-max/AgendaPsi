import type { Metadata } from "next";
import { AgendaAdminCliente } from "./AgendaAdminCliente";

export const metadata: Metadata = {
  title: { absolute: "Agenda | HumanaMentePsi" },
  description: "Grade semanal dos consultórios com reservas, horários fixos e solicitações pendentes.",
};

/** Wrapper de servidor da agenda administrativa (RF-042). */
export default function PaginaAgenda() {
  return <AgendaAdminCliente />;
}
