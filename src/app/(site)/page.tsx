import type { Metadata } from "next";
import Link from "next/link";
import { ENDERECO, HORARIO_FIM, HORARIO_INICIO, WHATSAPP_NUMERO } from "@/lib/constants";
import { InicioCliente } from "./InicioCliente";

export const metadata: Metadata = {
  title: { absolute: "HumanaMentePsi — Consultórios para sublocação na Barra da Tijuca" },
  description:
    "Três consultórios profissionais para sublocação na Avenida das Américas, Barra da Tijuca, Rio de Janeiro. Consulte a agenda em tempo real e solicite seu horário pelo WhatsApp.",
  keywords: [
    "sublocação consultório",
    "sala para psicólogo",
    "Barra da Tijuca",
    "consultório aluguel por hora",
    "HumanaMentePsi",
  ],
};

const HORARIO_TEXTO = `${String(HORARIO_INICIO).padStart(2, "0")}h às ${HORARIO_FIM}h`;

const ETIQUETAS_HERO = [
  "3 consultórios equipados",
  `Segunda a sábado, ${HORARIO_TEXTO}`,
  "Solicitação simples pelo WhatsApp",
];

const PASSOS: { titulo: string; descricao: string }[] = [
  {
    titulo: "Consulte a agenda",
    descricao:
      "Escolha o consultório e a data para ver, em tempo real, quais horários estão livres. De segunda a sábado, sem domingo.",
  },
  {
    titulo: "Escolha o horário",
    descricao:
      "Selecione o bloco de 1 hora e o tipo de reserva: horário fixo semanal, avulso ou reposição de aula.",
  },
  {
    titulo: "Solicite pelo WhatsApp",
    descricao:
      "Informe nome e telefone no formulário. Registramos a solicitação e abrimos a conversa no WhatsApp com todos os detalhes.",
  },
  {
    titulo: "Aguarde a confirmação",
    descricao:
      "O administrador valida a disponibilidade e confirma a reserva. Até lá, a solicitação ainda não reserva o horário.",
  },
];

const DIFERENCIAIS: { icone: string; titulo: string; texto: string }[] = [
  {
    icone: "🗓️",
    titulo: "Agenda em tempo real",
    texto: "Disponibilidade atualizada o tempo todo, sem risco de conflito de horários.",
  },
  {
    icone: "🛋️",
    titulo: "Três consultórios equipados",
    texto: "Ar-condicionado, Wi-Fi e um ambiente pensado para o atendimento.",
  },
  {
    icone: "📍",
    titulo: "Localização na Barra",
    texto: "Avenida das Américas, 1155 — fácil acesso e estacionamento por perto.",
  },
  {
    icone: "💬",
    titulo: "Tudo pelo WhatsApp",
    texto: "Sem cadastro e sem burocracia: você solicita e recebe a confirmação.",
  },
];

export default function PaginaInicial() {
  return (
    <>
      {/* Hero */}
      <section className="bg-petroleo-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-amarelo-300">
            Barra da Tijuca · Rio de Janeiro
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-5xl">
            HumanaMente<span className="text-salvia-300">Psi</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-petroleo-100 sm:text-lg">
            Espaço de atendimento profissional com três consultórios para sublocação por psicólogos e
            profissionais da área da saúde.
          </p>

          <address className="mt-5 flex items-start gap-2 text-sm not-italic text-petroleo-100">
            <span aria-hidden="true">📍</span>
            <span>
              {ENDERECO.rua} — {ENDERECO.bairro}, {ENDERECO.cidade}/{ENDERECO.uf}
            </span>
          </address>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/agenda"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-petroleo-800 transition-colors hover:bg-petroleo-50"
            >
              Ver a agenda
            </Link>
            <a
              href={`https://wa.me/${WHATSAPP_NUMERO}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-700 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-green-800"
            >
              Falar no WhatsApp
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap gap-2">
            {ETIQUETAS_HERO.map((etiqueta) => (
              <li
                key={etiqueta}
                className="rounded-full border border-petroleo-600 bg-petroleo-700 px-3 py-1.5 text-xs font-medium text-petroleo-100"
              >
                {etiqueta}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Consultórios (componente cliente — busca /api/public/rooms) */}
      <InicioCliente />

      {/* Como funciona */}
      <section aria-labelledby="titulo-como-funciona" className="bg-slate-50 py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 id="titulo-como-funciona" className="text-2xl font-bold text-petroleo-800 sm:text-3xl">
            Como funciona
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Da consulta à confirmação, o caminho é curto e transparente — em quatro passos você tem
            o seu horário.
          </p>

          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PASSOS.map((passo, indice) => (
              <li key={passo.titulo} className="card flex flex-col p-5">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-petroleo-700 text-sm font-bold text-white"
                >
                  {indice + 1}
                </span>
                <h3 className="mt-3 font-bold text-petroleo-800">{passo.titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{passo.descricao}</p>
              </li>
            ))}
          </ol>

          <p className="mt-6 rounded-lg border border-amarelo-300 bg-amarelo-100 px-4 py-3 text-sm text-slate-800">
            <strong className="font-semibold">Importante:</strong> solicitar um horário não é o mesmo
            que reservar. A reserva só existe depois da confirmação do administrador.
          </p>
        </div>
      </section>

      {/* Diferenciais resumidos */}
      <section aria-labelledby="titulo-diferenciais" className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 id="titulo-diferenciais" className="text-2xl font-bold text-petroleo-800 sm:text-3xl">
            Por que o HumanaMentePsi
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Um espaço pensado para quem atende: prático para o profissional e acolhedor para quem
            procura atendimento.
          </p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DIFERENCIAIS.map((item) => (
              <li key={item.titulo} className="card p-5">
                <span aria-hidden="true" className="text-2xl">
                  {item.icone}
                </span>
                <h3 className="mt-3 font-bold text-petroleo-800">{item.titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.texto}</p>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <Link
              href="/diferenciais"
              className="text-sm font-semibold text-petroleo-700 underline-offset-4 hover:underline"
            >
              Ver todos os diferenciais →
            </Link>
          </div>
        </div>
      </section>

      {/* Chamada final */}
      <section className="bg-petroleo-800 py-14 text-white sm:py-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Pronto para escolher o seu horário?</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-petroleo-100 sm:text-base">
              Veja a agenda em tempo real e envie a sua solicitação em poucos toques. Respondemos
              pelo WhatsApp, de segunda a sábado.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:shrink-0">
            <Link
              href="/agenda"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-petroleo-800 transition-colors hover:bg-petroleo-50"
            >
              Ver a agenda
            </Link>
            <a
              href={`https://wa.me/${WHATSAPP_NUMERO}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-700 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-green-800"
            >
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
