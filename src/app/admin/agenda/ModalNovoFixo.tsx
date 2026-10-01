"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { DIAS_SEMANA, horariosValidos } from "@/lib/constants";
import { diaSemana, formatarData, formatarHora, hojeIso } from "@/lib/dates";
import { RequisicaoErro, fetchAdmin, jsonInit, mensagemDe } from "../fetchAdmin";
import { useProfissionaisAtivos } from "./useProfissionais";
import type { ConsultorioAgenda } from "./tipos";

export interface ModalNovoFixoProps {
  aberto: boolean;
  aoFechar: () => void;
  consultorios: ConsultorioAgenda[];
  /** Sucesso confirmado pelo servidor: o pai fecha, exibe feedback e refaz a busca. */
  aoConcluir: (mensagem: string) => void;
}

interface FormFixo {
  consultorio_id: string;
  dia_semana: string;
  inicio: string;
  profissional_id: string;
  data_inicio: string;
  data_fim: string;
  valor: string;
  observacoes: string;
}

const HORARIOS = horariosValidos().map((h) => ({ valor: String(h), rotulo: formatarHora(h) }));

function formInicial(consultorios: ConsultorioAgenda[]): FormFixo {
  return {
    consultorio_id: consultorios.length > 0 ? String(consultorios[0].id) : "",
    dia_semana: "1",
    inicio: "9",
    profissional_id: "",
    data_inicio: hojeIso(),
    data_fim: "",
    valor: "",
    observacoes: "",
  };
}

/** Modal de criação de horário fixo semanal (RF-017 a RF-019). */
export function ModalNovoFixo({ aberto, aoFechar, consultorios, aoConcluir }: ModalNovoFixoProps) {
  const [form, setForm] = useState<FormFixo>(() => formInicial(consultorios));
  const [erro, setErro] = useState<string | null>(null);
  const [erroConflito, setErroConflito] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const { profissionais, carregando, erro: erroProfissionais, recarregar } = useProfissionaisAtivos(aberto);

  // Reflete a lista mais recente sem resetar o formulário durante o polling
  const consultoriosRef = useRef(consultorios);
  useEffect(() => {
    consultoriosRef.current = consultorios;
  }, [consultorios]);

  useEffect(() => {
    if (aberto) {
      setForm(formInicial(consultoriosRef.current));
      setErro(null);
      setErroConflito(null);
      setSalvando(false);
    }
  }, [aberto]);

  async function enviar(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (salvando) return;
    if (!form.profissional_id) {
      setErro("Selecione o profissional.");
      return;
    }
    if (!form.data_inicio) {
      setErro("Informe a data inicial.");
      return;
    }
    const diaEscolhido = Number(form.dia_semana);
    if (diaSemana(form.data_inicio) !== diaEscolhido) {
      const dia = DIAS_SEMANA.find((d) => d.numero === diaEscolhido)?.longo ?? "";
      setErro(`A data inicial não cai em ${dia}. Escolha uma data compatível com o dia da semana.`);
      return;
    }
    if (form.data_fim && form.data_fim < form.data_inicio) {
      setErro("A data final não pode ser anterior à data inicial.");
      return;
    }

    setSalvando(true);
    setErro(null);
    setErroConflito(null);
    try {
      await fetchAdmin(
        "/api/admin/recorrencias",
        jsonInit("POST", {
          consultorio_id: Number(form.consultorio_id),
          profissional_id: Number(form.profissional_id),
          dia_semana: diaEscolhido,
          inicio: Number(form.inicio),
          data_inicio: form.data_inicio,
          data_fim: form.data_fim || undefined,
          valor: form.valor.trim() || undefined,
          observacoes: form.observacoes.trim() || undefined,
        })
      );
      const dia = DIAS_SEMANA.find((d) => d.numero === diaEscolhido)?.longo ?? "";
      aoConcluir(`Horário fixo criado: ${dia} às ${form.inicio.padStart(2, "0")}h.`);
    } catch (e) {
      if (e instanceof RequisicaoErro && e.status === 409) {
        // Mantém o modal aberto e destaca a data do conflito
        setErroConflito(
          e.dataConflito
            ? `${e.message} Data do conflito: ${formatarData(e.dataConflito)}.`
            : e.message
        );
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
      titulo="Novo horário fixo"
      descricao="Repete toda semana no mesmo consultório, dia e horário."
      largura="lg"
    >
      <form className="space-y-4" onSubmit={(e) => void enviar(e)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="rotulo" htmlFor="fixo-consultorio">
              Consultório *
            </label>
            <select
              id="fixo-consultorio"
              className="campo"
              required
              disabled={salvando}
              value={form.consultorio_id}
              onChange={(e) => setForm({ ...form, consultorio_id: e.target.value })}
            >
              {consultorios.length === 0 && <option value="">Nenhum consultório disponível</option>}
              {consultorios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="rotulo" htmlFor="fixo-profissional">
              Profissional *
            </label>
            <select
              id="fixo-profissional"
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

          <div>
            <label className="rotulo" htmlFor="fixo-dia">
              Dia da semana *
            </label>
            <select
              id="fixo-dia"
              className="campo"
              required
              disabled={salvando}
              value={form.dia_semana}
              onChange={(e) => setForm({ ...form, dia_semana: e.target.value })}
            >
              {DIAS_SEMANA.map((d) => (
                <option key={d.numero} value={d.numero}>
                  {d.longo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="rotulo" htmlFor="fixo-inicio">
              Horário *
            </label>
            <select
              id="fixo-inicio"
              className="campo"
              required
              disabled={salvando}
              value={form.inicio}
              onChange={(e) => setForm({ ...form, inicio: e.target.value })}
            >
              {HORARIOS.map((h) => (
                <option key={h.valor} value={h.valor}>
                  {h.rotulo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="rotulo" htmlFor="fixo-data-inicio">
              Data inicial *
            </label>
            <input
              id="fixo-data-inicio"
              type="date"
              className="campo"
              required
              disabled={salvando}
              value={form.data_inicio}
              onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
            />
          </div>

          <div>
            <label className="rotulo" htmlFor="fixo-data-fim">
              Data final (opcional)
            </label>
            <input
              id="fixo-data-fim"
              type="date"
              className="campo"
              disabled={salvando}
              value={form.data_fim}
              onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="rotulo" htmlFor="fixo-valor">
              Valor acordado (opcional)
            </label>
            <input
              id="fixo-valor"
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
            <label className="rotulo" htmlFor="fixo-observacoes">
              Observações
            </label>
            <textarea
              id="fixo-observacoes"
              className="campo"
              rows={2}
              disabled={salvando}
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>
        </div>

        {erroConflito && (
          <div role="alert" className="rounded-lg border border-amarelo-300 bg-amarelo-100 px-3 py-2 text-sm text-slate-800">
            <p className="font-semibold">Horário já ocupado.</p>
            <p>{erroConflito}</p>
          </div>
        )}

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
            {salvando ? "Criando..." : "Criar horário fixo"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
