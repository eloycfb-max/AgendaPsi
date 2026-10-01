import Link from "next/link";
import { ENDERECO, WHATSAPP_EXIBICAO } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-lg font-bold text-petroleo-800">HumanaMentePsi</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Espaço de atendimento profissional com três consultórios para sublocação por psicólogos e
            profissionais da área da saúde.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-800">Localização</p>
          <address className="mt-2 text-sm not-italic leading-relaxed text-slate-600">
            {ENDERECO.rua}
            <br />
            {ENDERECO.bairro} — {ENDERECO.cidade}/{ENDERECO.uf}
          </address>
          <a
            href={ENDERECO.googleMaps}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm font-medium text-petroleo-700 underline hover:text-petroleo-900"
          >
            Abrir no Google Maps
          </a>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-800">Contato</p>
          <a
            href={`https://wa.me/5521987540264`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-sm font-medium text-green-700 underline hover:text-green-800"
          >
            WhatsApp {WHATSAPP_EXIBICAO}
          </a>
          <nav aria-label="Links institucionais" className="mt-3 flex flex-col gap-1 text-sm text-slate-600">
            <Link href="/agenda" className="hover:text-petroleo-700">Agenda</Link>
            <Link href="/politica-de-privacidade" className="hover:text-petroleo-700">Política de privacidade</Link>
            <Link href="/login" className="hover:text-petroleo-700">Área administrativa</Link>
          </nav>
        </div>
      </div>
      <div className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} HumanaMentePsi — Barra da Tijuca, Rio de Janeiro.
      </div>
    </footer>
  );
}
