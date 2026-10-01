import type { Metadata } from "next";
import Link from "next/link";
import { ENDERECO, WHATSAPP_EXIBICAO, WHATSAPP_NUMERO } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Como o HumanaMentePsi trata dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).",
};

const LINK_LEI = "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm";

export default function PaginaPoliticaDePrivacidade() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-widest text-salvia-600">
        HumanaMentePsi
      </p>
      <h1 className="mt-1 text-3xl font-bold text-petroleo-800 sm:text-4xl">
        Política de Privacidade
      </h1>
      <p className="mt-3 text-sm text-slate-500">Atualizada em 1º de outubro de 2026.</p>

      <p className="mt-6 text-sm leading-relaxed text-slate-700 sm:text-base">
        Esta política explica, de forma clara e em linguagem simples, como o HumanaMentePsi trata os
        dados pessoais de quem visita este site e envia solicitações de horário. Ela foi elaborada
        em conformidade com a Lei Geral de Proteção de Dados Pessoais —{" "}
        <a
          href={LINK_LEI}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-petroleo-700 underline-offset-4 hover:underline"
        >
          Lei nº 13.709/2018 (LGPD) ↗
        </a>
        .
      </p>

      <section aria-labelledby="tit-controlador" className="mt-8">
        <h2 id="tit-controlador" className="text-xl font-bold text-petroleo-800">
          1. Controlador dos dados
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
          O responsável pelo tratamento dos dados pessoais coletados neste site é:
        </p>
        <address className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm not-italic leading-relaxed text-slate-700">
          <strong className="font-semibold text-slate-900">Eloy Bezerra — HumanaMentePsi</strong>
          <br />
          {ENDERECO.rua}
          <br />
          {ENDERECO.bairro} — {ENDERECO.cidade}/{ENDERECO.uf}
          <br />
          Contato pelo WhatsApp:{" "}
          <a
            href={`https://wa.me/${WHATSAPP_NUMERO}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-petroleo-700 underline-offset-4 hover:underline"
          >
            {WHATSAPP_EXIBICAO}
          </a>
        </address>
      </section>

      <section aria-labelledby="tit-dados" className="mt-8">
        <h2 id="tit-dados" className="text-xl font-bold text-petroleo-800">
          2. Dados que coletamos
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
          Coletamos apenas os dados que você informa voluntariamente ao enviar uma solicitação de
          horário:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700 sm:text-base">
          <li>
            <strong className="font-semibold text-slate-900">Nome</strong> — para saber como te
            chamar e identificar a solicitação.
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Telefone</strong> — para responder
            pelo WhatsApp e confirmar a disponibilidade.
          </li>
          <li>
            Dados da solicitação em si: consultório, data, horário e tipo de reserva (fixo, avulso
            ou reposição).
          </li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-slate-700 sm:text-base">
          <strong className="font-semibold text-slate-900">Não coletamos</strong> dados de
          pacientes, prontuários, históricos de atendimento ou qualquer informação clínica. Este
          site não pede cadastro, senha ou documento de identificação.
        </p>
      </section>

      <section aria-labelledby="tit-finalidade" className="mt-8">
        <h2 id="tit-finalidade" className="text-xl font-bold text-petroleo-800">
          3. Finalidade do tratamento
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
          Os dados são usados exclusivamente para <strong className="font-semibold text-slate-900">tratar as
          solicitações de sublocação de consultório</strong>: verificar a disponibilidade do horário
          pedido, entrar em contato pelo WhatsApp, confirmar ou recusar a reserva e manter o
          histórico administrativo das solicitações.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
          Não usamos os seus dados para enviar publicidade, newsletters ou promoções, e não
          construímos perfis de comportamento.
        </p>
      </section>

      <section aria-labelledby="tit-base-legal" className="mt-8">
        <h2 id="tit-base-legal" className="text-xl font-bold text-petroleo-800">
          4. Base legal
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
          O tratamento acontece com fundamento nas hipóteses do art. 7º da LGPD:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700 sm:text-base">
          <li>
            <strong className="font-semibold text-slate-900">Consentimento</strong> (art. 7º, I) —
            ao informar nome e telefone e enviar a solicitação, você concorda com o uso desses
            dados para responder ao seu pedido. Você pode revogar o consentimento a qualquer
            momento.
          </li>
          <li>
            <strong className="font-semibold text-slate-900">Execução de contrato ou medidas
            pré-contratuais</strong> (art. 7º, V) — quando a solicitação segue para confirmação e
            para a gestão da reserva, o tratamento é necessário para cumprir o combinado entre as
            partes.
          </li>
        </ul>
      </section>

      <section aria-labelledby="tit-compartilhamento" className="mt-8">
        <h2 id="tit-compartilhamento" className="text-xl font-bold text-petroleo-800">
          5. Compartilhamento
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
          Seus dados são acessados <strong className="font-semibold text-slate-900">apenas pelo
          administrador do HumanaMentePsi</strong>, responsável por analisar e confirmar as
          solicitações. Não vendemos, não alugamos e não compartilhamos dados pessoais com
          empresas de marketing, analytics ou terceiros comerciais.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
          Quando você decide continuar a conversa no WhatsApp, a mensagem é processada pela Meta
          Platforms, conforme a política de privacidade do próprio serviço.
        </p>
      </section>

      <section aria-labelledby="tit-retencao" className="mt-8">
        <h2 id="tit-retencao" className="text-xl font-bold text-petroleo-800">
          6. Conservação e retenção
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
          Os dados são mantidos enquanto forem necessários para a gestão das solicitações e o
          cumprimento das obrigações administrativas do espaço. Encerrada essa necessidade, os
          registros são eliminados ou anonimizados, de forma segura.
        </p>
      </section>

      <section aria-labelledby="tit-direitos" className="mt-8">
        <h2 id="tit-direitos" className="text-xl font-bold text-petroleo-800">
          7. Os seus direitos (art. 18 da LGPD)
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
          Você pode, a qualquer momento, solicitar:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700 sm:text-base">
          <li>confirmação da existência de tratamento dos seus dados;</li>
          <li>acesso aos dados que temos sobre você;</li>
          <li>correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>eliminação dos dados, quando aplicável;</li>
          <li>informação sobre compartilhamento e sobre as consequências de recusar fornecer dados;</li>
          <li>revogação do consentimento concedido.</li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-slate-700 sm:text-base">
          Para exercer esses direitos, é só chamar no WhatsApp{" "}
          <a
            href={`https://wa.me/${WHATSAPP_NUMERO}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-petroleo-700 underline-offset-4 hover:underline"
          >
            {WHATSAPP_EXIBICAO}
          </a>{" "}
          e pedir atendimento sobre a sua solicitação. Respondemos com brevidade.
        </p>
      </section>

      <section aria-labelledby="tit-seguranca" className="mt-8">
        <h2 id="tit-seguranca" className="text-xl font-bold text-petroleo-800">
          8. Segurança da informação
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
          Adotamos medidas proporcionais à natureza dos dados tratados: a área administrativa é
          protegida por login e sessão com expiração automática, o banco de dados fica restrito ao
          servidor do sistema e as páginas públicas não exibem nomes, telefones ou valores de
          terceiros. Todo o acompanhamento das alterações fica registrado em auditoria interna.
        </p>
      </section>

      <section aria-labelledby="tit-cookies" className="mt-8">
        <h2 id="tit-cookies" className="text-xl font-bold text-petroleo-800">
          9. Cookies
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
          O site público não usa cookies de publicidade ou de rastreamento. O único cookie
          utilizado é o de sessão da área administrativa, essencial para manter o acesso protegido,
          e ele expira automaticamente após algumas horas.
        </p>
      </section>

      <section aria-labelledby="tit-alteracoes" className="mt-8">
        <h2 id="tit-alteracoes" className="text-xl font-bold text-petroleo-800">
          10. Alterações nesta política
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
          Esta página pode ser atualizada para refletir mudanças no site ou na legislação. A data da
          última atualização fica no início do documento; alterações relevantes serão comunicadas
          pelo WhatsApp quando necessário.
        </p>
      </section>

      <div className="mt-10 rounded-xl bg-petroleo-800 p-6 text-white">
        <h2 className="text-lg font-bold">Ficou com alguma dúvida?</h2>
        <p className="mt-2 text-sm leading-relaxed text-petroleo-100">
          Fale conosco pelo WhatsApp {WHATSAPP_EXIBICAO} — teremos prazer em esclarecer como
          cuidamos dos seus dados.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <a
            href={`https://wa.me/${WHATSAPP_NUMERO}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800"
          >
            Falar no WhatsApp
          </a>
          <Link
            href="/contato"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-petroleo-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-petroleo-700"
          >
            Página de contato
          </Link>
        </div>
      </div>
    </div>
  );
}
