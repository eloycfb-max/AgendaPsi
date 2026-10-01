"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { TIPOS_RESERVA, type TipoReserva } from "@/lib/constants";
import { formatarDataLonga, formatarHora } from "@/lib/dates";
import { montarLinkWhatsApp } from "@/lib/whatsapp";
import type { SlotSelecionado } from "./types";

interface ModalSolicitacaoProps {
  /** Horário clicado; null mantém o modal fechado. */
  slot: SlotSelecionado | null;
  /** Tipo escolhido no filtro — pré-preenche o rádio (RF-014/RF-033). */
  tipoInicial: TipoReserva;
  aoFechar: () => void;
}

interface ErrosCampo {
  nome?: string;
  telefone?: string;
}

const TIPOS = Object.keys(TIPOS_RESERVA) as TipoReserva[];

/**
 * Solicitação de sublocação (RF-033 a RF-038):
 * 1) POST /api/public/solicitacoes e AGUARDA a resposta do servidor;
 * 2) só com 201 monta o link do WhatsApp e abre em nova aba;
 * 3) nunca trata a solicitação como reserva confirmada.
 */
export function ModalSolicitacao({ slot, tipoInicial, aoFechar }: ModalSolicitacaoProps) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [tipo, setTipo] = useState<TipoReserva>(tipoInicial);
  const [errosCampo, setErrosCampo] = useState<ErrosCampo>({});
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [linkWhats, setLinkWhats] = useState<string | null>(null);

  // Reinicia o formulário toda vez que o modal abre.
  useEffect(() => {
    if (!slot) return;
    setNome("");
    setTelefone("");
    setTipo(tipoInicial);
    setErrosCampo({});
    setErroEnvio(null);
    setEnviando(false);
    setSucesso(false);
    setLinkWhats(null);
  }, [slot, tipoInicial]);

  async function enviar(evento: React.FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    if (!slot || enviando) return;

    // Validação local (mensagens em pt-BR, iguais às do servidor).
    const problemaNome =
      nome.trim().length < 3 ? "Informe seu nome completo (mínimo 3 caracteres)." : undefined;
    const problemaTelefone =
      telefone.replace(/\D/g, "").length < 10 ? "Informe um telefone válido com DDD." : undefined;
    setErrosCampo({ nome: problemaNome, telefone: problemaTelefone });
    if (problemaNome || problemaTelefone) return;

    setEnviando(true);
    setErroEnvio(null);

    // Abre a aba em branco já dentro do gesto do usuário para não ser
    // bloqueada pelo navegador; é fechada se o servidor recusar.
    const janela = window.open("about:blank", "_blank");

    try {
      const resposta = await fetch("/api/public/solicitacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          telefone: telefone.trim(),
          consultorio_id: slot.consultorioId,
          data: slot.data,
          inicio: slot.hora,
          tipo,
        }),
      });
      const json = (await resposta.json().catch(() => null)) as {
        ok?: boolean;
        erro?: string;
      } | null;

      if (resposta.status !== 201 || json?.ok !== true) {
        janela?.close();
        setErroEnvio(
          json?.erro ?? "Não foi possível registrar a solicitação. Verifique sua conexão e tente novamente."
        );
        return;
      }

      // Somente após a confirmação (201) do servidor: monta e abre o WhatsApp.
      const link = montarLinkWhatsApp({
        nome: nome.trim(),
        consultorio: slot.consultorioNome,
        data: slot.data,
        inicio: slot.hora,
        fim: slot.hora + 1,
        tipo,
      });
      if (janela && !janela.closed) {
        janela.opener = null;
        janela.location.href = link;
        janela.focus();
      } else {
        window.open(link, "_blank", "noopener,noreferrer");
      }
      setLinkWhats(link);
      setSucesso(true);
    } catch {
      janela?.close();
      setErroEnvio(
        "Falha de conexão com o servidor — a sua solicitação NÃO foi registrada. Tente novamente."
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      aberto={slot !== null}
      aoFechar={aoFechar}
      titulo={sucesso ? "Solicitação enviada" : "Solicitar horário"}
      descricao={
        sucesso
          ? undefined
          : "Preencha os seus dados para registrarmos a solicitação de sublocação."
      }
      largura="md"
    >
      {slot && !sucesso && (
        <form onSubmit={(e) => void enviar(e)} noValidate>
          {/* Resumo do horário escolhido */}
          <dl className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Consultório</dt>
              <dd className="font-semibold text-slate-800">{slot.consultorioNome}</dd>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <dt className="text-slate-500">Data</dt>
              <dd className="text-right font-semibold text-slate-800">
                {formatarDataLonga(slot.data)}
              </dd>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <dt className="text-slate-500">Horário</dt>
              <dd className="font-semibold text-slate-800">
                {formatarHora(slot.hora, slot.hora + 1)}
              </dd>
            </div>
          </dl>

          {/* Nome */}
          <div className="mt-4">
            <label className="rotulo" htmlFor="solicitacao-nome">
              Nome completo <span aria-hidden="true">*</span>
            </label>
            <input
              id="solicitacao-nome"
              type="text"
              className="campo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="name"
              minLength={3}
              required
              placeholder="Como você se chama"
              aria-invalid={errosCampo.nome !== undefined}
              aria-describedby={errosCampo.nome ? "solicitacao-nome-erro" : undefined}
            />
            {errosCampo.nome && (
              <p id="solicitacao-nome-erro" role="alert" className="mt-1 text-xs font-medium text-red-700">
                {errosCampo.nome}
              </p>
            )}
          </div>

          {/* Telefone */}
          <div className="mt-4">
            <label className="rotulo" htmlFor="solicitacao-telefone">
              Telefone com DDD <span aria-hidden="true">*</span>
            </label>
            <input
              id="solicitacao-telefone"
              type="tel"
              className="campo"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              autoComplete="tel"
              inputMode="tel"
              required
              placeholder="(21) 99999-9999"
              aria-invalid={errosCampo.telefone !== undefined}
              aria-describedby={errosCampo.telefone ? "solicitacao-telefone-erro" : undefined}
            />
            {errosCampo.telefone && (
              <p
                id="solicitacao-telefone-erro"
                role="alert"
                className="mt-1 text-xs font-medium text-red-700"
              >
                {errosCampo.telefone}
              </p>
            )}
          </div>

          {/* Tipo de sublocação (pré-preenchido com o filtro) */}
          <fieldset className="mt-4">
            <legend className="rotulo">Tipo de sublocação</legend>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <label
                  key={t}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    tipo === t
                      ? "border-petroleo-600 bg-petroleo-50 font-semibold text-petroleo-800"
                      : "border-slate-300 bg-white text-slate-600 hover:border-petroleo-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="solicitacao-tipo"
                    value={t}
                    checked={tipo === t}
                    onChange={() => setTipo(t)}
                    className="h-4 w-4 accent-petroleo-700"
                  />
                  {TIPOS_RESERVA[t].rotulo}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Erro do servidor / conexão */}
          {erroEnvio && (
            <div role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3">
              <p className="text-sm font-semibold text-red-800">
                Não foi possível registrar a solicitação.
              </p>
              <p className="mt-1 text-sm text-red-700">{erroEnvio}</p>
            </div>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={aoFechar} className="btn-secundario">
              Cancelar
            </button>
            <button type="submit" className="btn-primario" disabled={enviando}>
              {enviando
                ? "Registrando…"
                : erroEnvio
                  ? "Tentar novamente"
                  : "Registrar solicitação e abrir WhatsApp"}
            </button>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Registramos a solicitação e abrimos o WhatsApp com a mensagem pronta. Solicitar{" "}
            <strong>não</strong> reserva o horário: a confirmação é feita pelo administrador.
          </p>
        </form>
      )}

      {slot && sucesso && (
        <div role="status" className="py-2 text-center">
          <span
            aria-hidden="true"
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-salvia-100 text-2xl text-salvia-800"
          >
            ✓
          </span>
          <p className="mt-3 font-bold text-slate-900">Solicitação registrada!</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            O WhatsApp foi aberto com a mensagem pronta — envie-a e aguarde a confirmação do
            administrador. A solicitação <strong>NÃO</strong> é uma reserva confirmada.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {linkWhats && (
              <a
                href={linkWhats}
                target="_blank"
                rel="noopener noreferrer"
                className="btn bg-green-600 text-white hover:bg-green-700"
              >
                Abrir WhatsApp novamente
              </a>
            )}
            <button type="button" onClick={aoFechar} className="btn-secundario">
              Fechar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
