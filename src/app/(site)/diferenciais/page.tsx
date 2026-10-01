import type { Metadata } from "next";
import Link from "next/link";
import { ENDERECO, WHATSAPP_EXIBICAO, WHATSAPP_NUMERO } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Diferenciais",
  description:
    "Agenda em tempo real, três consultórios equipados, localização na Barra da Tijuca, solicitação pelo WhatsApp e preços transparentes.",
};

const DIFERENCIAIS: { icone: string; titulo: string; texto: string }[] = [
  {
    icone: "🗓️",
    titulo: "Agenda compartilhada em tempo real",
    texto:
      "Os três consultórios convivem na mesma agenda, atualizada a cada instante. Dois profissionais nunca recebem o mesmo horário: o sistema bloqueia conflitos antes de qualquer confirmação.",
  },
  {
    icone: "🛋️",
    titulo: "Três consultórios equipados",
    texto:
      "Ar-condicionado, Wi-Fi e ambiente limpo e silencioso em todos os espaços — chegou, plugou e atendeu, sem se preocupar com a infraestrutura.",
  },
  {
    icone: "📍",
    titulo: "Localização na Barra da Tijuca",
    texto: `Em ${ENDERECO.rua}, ${ENDERECO.bairro} — ${ENDERECO.cidade}/${ENDERECO.uf}, com fácil acesso, estacionamento nas redondezas e referência para quem já atende na região.`,
  },
  {
    icone: "💬",
    titulo: "Solicitação simples pelo WhatsApp",
    texto:
      "Escolha o horário na agenda, informe nome e telefone e continue a conversa no WhatsApp. Sem cadastro, sem senhas e sem burocracia.",
  },
  {
    icone: "💰",
    titulo: "Preços transparentes",
    texto:
      "Os valores de cada tipo de reserva aparecem logo na página do consultório. Quando um preço ainda não foi publicado, mostramos “Consulte o valor” — nada de letras miúdas.",
  },
  {
    icone: "📅",
    titulo: "Fixo, avulso e reposição",
    texto:
      "Reserve um horário fixo semanal, um horário avulso para uma sessão pontual ou uma reposição de aula. Três formatos para diferentes rotinas.",
  },
  {
    icone: "🖥️",
    titulo: "Painel administrativo profissional",
    texto:
      "Quem administra o espaço conta com reservas, recorrências, solicitações, financeiro, relatórios e auditoria — o que mantém a agenda confiável para todos.",
  },
];

export default function PaginaDiferenciais() {
  return (
    <>
      <header className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-salvia-600">
            HumanaMentePsi
          </p>
          <h1 className="mt-1 text-3xl font-bold text-petroleo-800 sm:text-4xl">Diferenciais</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            O que faz do HumanaMentePsi um espaço simples de usar para o profissional e confiável
            para quem procura atendimento.
          </p>
        </div>
      </header>

      <section aria-label="Lista de diferenciais" className="py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4">
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {DIFERENCIAIS.map((item) => (
              <li key={item.titulo} className="card flex flex-col p-6">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-petroleo-50 text-xl"
                >
                  {item.icone}
                </span>
                <h2 className="mt-4 text-lg font-bold text-petroleo-800">{item.titulo}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.texto}</p>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-col gap-3 rounded-xl bg-petroleo-800 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div>
              <h2 className="text-xl font-bold">Venha conhecer o espaço</h2>
              <p className="mt-1 text-sm text-petroleo-100">
                Consulte a agenda em tempo real ou fale conosco pelo WhatsApp{" "}
                {WHATSAPP_EXIBICAO}.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link
                href="/agenda"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-petroleo-800 transition-colors hover:bg-petroleo-50"
              >
                Ver a agenda
              </Link>
              <a
                href={`https://wa.me/${WHATSAPP_NUMERO}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800"
              >
                Falar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
