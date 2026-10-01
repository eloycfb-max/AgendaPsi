import type { Metadata } from "next";
import Link from "next/link";
import {
  ENDERECO,
  HORARIO_FIM,
  HORARIO_INICIO,
  WHATSAPP_EXIBICAO,
  WHATSAPP_NUMERO,
} from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contato",
  description:
    "Fale com o HumanaMentePsi: Avenida das Américas 1155, Barra da Tijuca. WhatsApp +55 21 98754-0264, de segunda a sábado, das 07h às 21h.",
};

const HORARIO_TEXTO = `${String(HORARIO_INICIO).padStart(2, "0")}h às ${HORARIO_FIM}h`;

export default function PaginaContato() {
  return (
    <>
      <header className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-salvia-600">
            HumanaMentePsi
          </p>
          <h1 className="mt-1 text-3xl font-bold text-petroleo-800 sm:text-4xl">Contato</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Tire dúvidas sobre os consultórios, valores ou disponibilidade. Respondemos pelo
            WhatsApp, sempre com agilidade e cuidado.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Localização */}
          <section aria-labelledby="titulo-localizacao" className="card p-6">
            <span aria-hidden="true" className="text-2xl">
              📍
            </span>
            <h2 id="titulo-localizacao" className="mt-3 text-lg font-bold text-petroleo-800">
              Localização
            </h2>
            <address className="mt-2 text-sm not-italic leading-relaxed text-slate-600">
              {ENDERECO.rua}
              <br />
              {ENDERECO.bairro} — {ENDERECO.cidade}/{ENDERECO.uf}
              <br />
              CEP {ENDERECO.cep}
            </address>
            <a
              href={ENDERECO.googleMaps}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm font-semibold text-petroleo-700 underline-offset-4 hover:underline"
            >
              Abrir no Google Maps ↗
            </a>
          </section>

          {/* Horários */}
          <section aria-labelledby="titulo-horarios" className="card p-6">
            <span aria-hidden="true" className="text-2xl">
              🕘
            </span>
            <h2 id="titulo-horarios" className="mt-3 text-lg font-bold text-petroleo-800">
              Horário de funcionamento
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Segunda-feira a sábado, das {HORARIO_TEXTO}.
            </p>
            <p className="mt-3 rounded-lg border border-amarelo-300 bg-amarelo-100 px-3 py-2 text-sm font-medium text-slate-800">
              Atenção: aos domingos o espaço fica fechado e a agenda não abre blocos de horário.
            </p>
          </section>
        </div>

        {/* WhatsApp */}
        <section aria-labelledby="titulo-whatsapp" className="card mt-6 p-6 text-center sm:p-8">
          <h2 id="titulo-whatsapp" className="text-lg font-bold text-petroleo-800">
            Fale pelo WhatsApp
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            É o canal mais rápido para tirar dúvidas, confirmar valores e acompanhar a sua
            solicitação de horário.
          </p>
          <a
            href={`https://wa.me/${WHATSAPP_NUMERO}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Falar com a HumanaMentePsi no WhatsApp ${WHATSAPP_EXIBICAO}`}
            className="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-green-700 px-6 py-4 text-base font-bold text-white transition-colors hover:bg-green-800 sm:w-auto sm:px-8 sm:text-lg"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-6 w-6 shrink-0"
              focusable="false"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
            </svg>
            <span>WhatsApp {WHATSAPP_EXIBICAO}</span>
          </a>
          <p className="mt-4 text-sm text-slate-600">
            Prefere outro caminho? Veja a nossa{" "}
            <Link
              href="/politica-de-privacidade"
              className="font-semibold text-petroleo-700 underline-offset-4 hover:underline"
            >
              política de privacidade
            </Link>{" "}
            ou consulte a{" "}
            <Link
              href="/agenda"
              className="font-semibold text-petroleo-700 underline-offset-4 hover:underline"
            >
              agenda em tempo real
            </Link>
            .
          </p>
        </section>
      </div>
    </>
  );
}
