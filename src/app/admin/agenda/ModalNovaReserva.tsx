"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { formatarData, formatarHora } from "@/lib/dates";
import { RequisicaoErro, fetchAdmin, jsonInit, mensagemDe } from "../fetchAdmin";
import { useProfissionaisAtivos } from "./useProfissionais";

export interface ModalNovaReservaProps {
  aberto: boolean;
  aoFechar: () => void;
  data: string;
  hora: number;
  consultorioId: number;
  consultorioNome: string;
  /** Sucesso confirmado pelo servidor: o pai fecha, mostra feedback e refaz a busca. */
  aoConcluir: (mensagem: string) => void;
  /** 409: o pai refaz a busca (o modal permanece aberto com o aviso). */
  aoConflito: () => void;
}

interface FormReserva {
  profissional_id: string;
  tipo: "avulsa" | "reposicao";
  valor: string;
  vencimento: string;
  observacoes: string;
}

const FORM_INICIAL: FormReserva = {
  profissional_id: "",
  tipo: "avulsa",
  valor: "",
  vencimento: "",
  observacoes: "",
};

/** Modal de criação de reserva avulsa ou de reposição em um horário livre. */
export function ModalNovaReserva({
  aberto,
  aoFechar,
  data,
  hora,
  consultorioId,
  consultorioNome,
  aoConcluir,
  aoConflito,
}: ModalNovaReservaProps) {
  const [form, setForm] = useState<FormReserva>(FORM_INICIAL);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const { profissionais, carregando, erro: erroProfissionais, recarregar } = useProfissionaisAtivos(aberto);

  useEffect(() => {
    if (aberto) {
      setForm(FORM_INICIAL);
      setErro(null);
      setSalvando(false);
    }
  }, [aberto, data, hora]);

  async function enviar(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (salvando) return;
    if (!form.profissional_id) {
      setErro("Selecione o profissional.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await fetchAdmin(
        "/api/admin/reservas",
        jsonInit("POST", {
          consultorio_id: consultorioId,
          profissional_id: Number(form.profissional_id),
          tipo: form.tipo,
          data,
          inicio: hora,
          valor: form.valor.trim() || undefined,
          vencimento: form.vencimento || undefined,
          observacoes: form.observacoes.trim() || undefined,
        })
      );
      aoConcluir(`Reserva de ${formatarHora(hora)} em ${formatarData(data)} criada com sucesso.`);
    } catch (e) {
      if (e instanceof RequisicaoErro && e.status === 409) {
        setErro("Horário já ocupado. Feche a janela e escolha outro horário na grade.");
        aoConflito();
      } else {
        setErro(mensagemDe(e));
      }
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Nova reserva"
      descricao={`${consultorioNome} · ${formatarData(data)} · ${formatarHora(hora)}`}
    >
      <form className="space-y-4" onSubmit={(e) => void enviar(e)}>
        <fieldset className="space-y-1">
          <legend className="rotulo">Tipo de reserva *</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="tipo-reserva"
                value="avulsa"
                checked={form.tipo === "avulsa"}
                onChange={() => setForm({ ...form, tipo: "avulsa" })}
                disabled={salvando}
              />
              Avulso
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="tipo-reserva"
                value="reposicao"
                checked={form.tipo === "reposicao"}
                onChange={() => setForm({ ...form, tipo: "reposicao" })}
                disabled={salvando}
              />
              Reposição
            </label>
          </div>
        </fieldset>

        <div>
          <label className="rotulo" htmlFor="nova-reserva-profissional">
            Profissional *
          </label>
          <select
            id="nova-reserva-profissional"
            className="campo"
            required
            disabled={salvando || carregando}
            value={form.profissional_id}
            onChange={(e) => setForm({ ...form, profissional_id: e.target.value })}
          >
            <option value="">
              {carregando ? "Carregando profissionais..." : "Selecione..."}
            </option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.profissao ? ` — ${p.profissao}` : ""}
              </option>
            ))}
          </select>
          {erroProfissionais && (
            <p className="mt-1 text-xs text-red-700">
              {erroProfissionais}{" "}
              <button type="button" className="underline" onClick={recarregar}>
                Tentar novamente
              </button>
            </p>
          )}
          {!carregando && !erroProfissionais && profissionais.length === 0 && (
            <p className="mt-1 text-xs text-red-700">Nenhum profissional ativo cadastrado.</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="rotulo" htmlFor="nova-reserva-valor">
              Valor acordado (opcional)
            </label>
            <input
              id="nova-reserva-valor"
              type="text"
              inputMode="decimal"
              className="campo"
              placeholder="120,00"
              disabled={salvando}
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="nova-reserva-vencimento">
              Vencimento (opcional)
            </label>
            <input
              id="nova-reserva-vencimento"
              type="date"
              className="campo"
              disabled={salvando}
              value={form.vencimento}
              onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="rotulo" htmlFor="nova-reserva-observacoes">
            Observações
          </label>
          <textarea
            id="nova-reserva-observacoes"
            className="campo"
            rows={3}
            disabled={salvando}
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          />
        </div>

        {erro && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secundario" disabled={salvando} onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="btn-primario" disabled={salvando}>
            {salvando ? "Salvando..." : "Criar reserva"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
