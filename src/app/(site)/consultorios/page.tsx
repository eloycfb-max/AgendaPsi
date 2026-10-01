import type { Metadata } from "next";
import { ConsultoriosCliente } from "./ConsultoriosCliente";

export const metadata: Metadata = {
  title: "Consultórios",
  description:
    "Conheça os três consultórios do HumanaMentePsi na Barra da Tijuca: fotos, recursos, valores de horário fixo, avulso e reposição.",
};

export default function PaginaConsultorios() {
  return (
    <>
      <header className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-salvia-600">
            HumanaMentePsi
          </p>
          <h1 className="mt-1 text-3xl font-bold text-petroleo-800 sm:text-4xl">Consultórios</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Três espaços de atendimento profissional, equipados e prontos para receber você e os seus
            pacientes. Veja fotos, recursos e os valores de cada tipo de reserva — e solicite o seu
            horário pela agenda.
          </p>
        </div>
      </header>

      <ConsultoriosCliente />
    </>
  );
}
