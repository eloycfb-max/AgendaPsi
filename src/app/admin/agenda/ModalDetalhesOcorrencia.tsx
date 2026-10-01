"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { TIPOS_RESERVA, horariosValidos } from "@/lib/constants";
import { formatarData, formatarDataLonga, formatarHora, formatarMoeda } from "@/lib/dates";
import { RequisicaoErro, fetchAdmin, jsonInit, mensagemDe } from "../fetchAdmin";
import { useProfissionaisAtivos } from "./useProfissionais";
import type { OcorrenciaAgenda } from "./tipos";

export interface ModalDetalhesOcorrenciaProps {
  ocorrencia: OcorrenciaAgenda | null;
  consultorioNome: string;
  aberto: boolean;
  aoFechar: () => void;
  /** Ação concluída pelo servidor: o pai fecha, exibe feedback e refaz a busca. */
  aoConcluir: (mensagem: string) => void;
}

type Confirmacao = null | "cancelar" | "liberar" | "encerrar1" | "encerrar2";

interface FormEdicao {
  data: string;
  inicio: string;
  profissional_id: string;
  valor: string;
}

function valorParaTexto(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

const HORARIOS = horariosValidos().map((h) => ({ valor: String(h), rotulo: formatarHora(h) }));

/** Detalhes de uma ocorrência + ações de edição, cancelamento e recorrência. */
export function ModalDetalhesOcorrencia({
  ocorrencia,
  consultorioNome,
  aberto,
  aoFechar,
  aoConcluir,
}: ModalDetalhesOcorrenciaProps) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<FormEdicao>({ data: "", inicio: "", profissional_id: "", valor: "" });
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const { profissionais, carregando: carregandoProfissionais, erro: erroProfissionais, recarregar } =
    useProfissionaisAtivos(aberto && editando);

  const ehFixo = ocorrencia?.tipo === "fixo";
  const ehReserva = ocorrencia !== null && ocorrencia.reserva_id !== null;

  // Sempre acessa a ocorrência mais recente (o polling troca a referência)
  const ocorrenciaRef = useRef(ocorrencia);
  useEffect(() => {
    ocorrenciaRef.current = ocorrencia;
  }, [ocorrencia]);

  // Identidade da ocorrência: o polling não deve reiniciar o modal aberto
  const chave = ocorrencia
    ? `${ocorrencia.tipo}:${ocorrencia.reserva_id ?? "-"}:${ocorrencia.recorrencia_id ?? "-"}:${ocorrencia.data}:${ocorrencia.inicio}`
    : "";

  useEffect(() => {
    const atual = ocorrenciaRef.current;
    if (aberto && atual) {
      setEditando(false);
      setConfirmacao(null);
      setErro(null);
      setProcessando(false);
      setForm({
        data: atual.data,
        inicio: String(atual.inicio),
        profissional_id: String(atual.profissional_id),
        valor: valorParaTexto(atual.valor_acordado),
      });
    }
  }, [aberto, chave]);

  async function salvarEdicao(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!ocorrencia || !ocorrencia.reserva_id || processando) return;
    if (!form.profissional_id) {
      setErro("Selecione o profissional.");
      return;
    }
    setProcessando(true);
    setErro(null);
    try {
      await fetchAdmin(
        `/api/admin/reservas/${ocorrencia.reserva_id}`,
        jsonInit("PUT", {
          data: form.data,
          inicio: Number(form.inicio),
          profissional_id: Number(form.profissional_id),
          valor: form.valor.trim() || undefined,
        })
      );
      aoConcluir(`Reserva atualizada para ${formatarData(form.data)} às ${Number(form.inicio)}h.`);
    } catch (e2) {
      setErro(mensagemDe(e2));
      setProcessando(false);
    }
  }

  async function cancelarReserva(): Promise<void> {
    if (!ocorrencia || !ocorrencia.reserva_id || processando) return;
    setProcessando(true);
    setErro(null);
    try {
      await fetchAdmin(`/api/admin/reservas/${ocorrencia.reserva_id}`, { method: "DELETE" });
      aoConcluir("Reserva cancelada. O histórico foi preservado.");
    } catch (e) {
      setErro(mensagemDe(e));
      setProcessando(false);
      setConfirmacao(null);
    }
  }

  async function liberarOcorrencia(): Promise<void> {
    if (!ocorrencia || !ocorrencia.recorrencia_id || processando) return;
    setProcessando(true);
    setErro(null);
    try {
      await fetchAdmin(
        `/api/admin/recorrencias/${ocorrencia.recorrencia_id}/excecoes`,
        jsonInit("POST", { data: ocorrencia.data })
      );
      aoConcluir(`Ocorrência de ${formatarData(ocorrencia.data)} liberada; as demais continuam bloqueadas.`);
    } catch (e) {
      setErro(mensagemDe(e));
      setProcessando(false);
      setConfirmacao(null);
    }
  }

  async function encerrarSerie(): Promise<void> {
    if (!ocorrencia || !ocorrencia.recorrencia_id || processando) return;
    setProcessando(true);
    setErro(null);
    try {
      await fetchAdmin(`/api/admin/recorrencias/${ocorrencia.recorrencia_id}`, { method: "DELETE" });
      aoConcluir("Série de horário fixo encerrada.");
    } catch (e) {
      setErro(mensagemDe(e));
      setProcessando(false);
      setConfirmacao(null);
    }
  }

  if (!ocorrencia) return null;

  const tipo = TIPOS_RESERVA[ocorrencia.tipo];

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Detalhes da reserva"
      descricao={`${tipo.rotulo} · ${consultorioNome}`}
    >
      <div className="space-y-4">
        {!editando ? (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="font-medium text-slate-500">Tipo</dt>
              <dd className="text-right font-semibold text-slate-900">{tipo.rotulo}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-medium text-slate-500">Profissional</dt>
              <dd className="text-right text-slate-900">{ocorrencia.nome_profissional}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-medium text-slate-500">Data</dt>
              <dd className="text-right text-slate-900">{formatarDataLonga(ocorrencia.data)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-medium text-slate-500">Horário</dt>
              <dd className="text-right text-slate-900">{formatarHora(ocorrencia.inicio, ocorrencia.fim)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-medium text-slate-500">Valor</dt>
              <dd className="text-right text-slate-900">{formatarMoeda(ocorrencia.valor_acordado)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-medium text-slate-500">Observações</dt>
              <dd className="max-w-[60%] text-right text-slate-900">
                {ocorrencia.observacoes?.trim() ? ocorrencia.observacoes : "—"}
              </dd>
            </div>
          </dl>
        ) : (
          <form className="space-y-4" onSubmit={(e) => void salvarEdicao(e)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="rotulo" htmlFor="edt-oc-data">
                  Data
                </label>
                <input
                  id="edt-oc-data"
                  type="date"
                  className="campo"
                  required
                  disabled={processando}
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                />
              </div>
              <div>
                <label className="rotulo" htmlFor="edt-oc-inicio">
                  Horário
                </label>
                <select
                  id="edt-oc-inicio"
                  className="campo"
                  disabled={processando}
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
            </div>

            <div>
              <label className="rotulo" htmlFor="edt-oc-profissional">
                Profissional
              </label>
              <select
                id="edt-oc-profissional"
                className="campo"
                required
                disabled={processando || carregandoProfissionais}
                value={form.profissional_id}
                onChange={(e) => setForm({ ...form, profissional_id: e.target.value })}
              >
                <option value="">
                  {carregandoProfissionais ? "Carregando profissionais..." : "Selecione..."}
                </option>
                {profissionais.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
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
            </div>

            <div>
              <label className="rotulo" htmlFor="edt-oc-valor">
                Valor acordado
              </label>
              <input
                id="edt-oc-valor"
                type="text"
                inputMode="decimal"
                className="campo"
                placeholder="120,00"
                disabled={processando}
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secundario"
                disabled={processando}
                onClick={() => setEditando(false)}
              >
                Voltar
              </button>
              <button type="submit" className="btn-primario" disabled={processando}>
                {processando ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </form>
        )}

        {erro && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {erro}
          </p>
        )}

        {/* Ações ---------------------------------------------------------------- */}
        {!editando && confirmacao === null && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
            {ehReserva && (
              <>
                <button
                  type="button"
                  className="btn-secundario"
                  disabled={processando}
                  onClick={() => {
                    setErro(null);
                    setEditando(true);
                  }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="btn-perigo"
                  disabled={processando}
                  onClick={() => {
                    setErro(null);
                    setConfirmacao("cancelar");
                  }}
                >
                  Cancelar reserva
                </button>
              </>
            )}
            {ehFixo && ocorrencia.recorrencia_id !== null && (
              <>
                <button
                  type="button"
                  className="btn-secundario"
                  disabled={processando}
                  onClick={() => {
                    setErro(null);
                    setConfirmacao("liberar");
                  }}
                >
                  Liberar só esta ocorrência
                </button>
                <button
                  type="button"
                  className="btn-perigo"
                  disabled={processando}
                  onClick={() => {
                    setErro(null);
                    setConfirmacao("encerrar1");
                  }}
                >
                  Encerrar a série
                </button>
              </>
            )}
          </div>
        )}

        {/* Confirmação: cancelar reserva pontual */}
        {!editando && confirmacao === "cancelar" && (
          <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-800">
              Cancelar esta reserva de <strong>{formatarData(ocorrencia.data)}</strong> às{" "}
              <strong>{formatarHora(ocorrencia.inicio)}</strong>? O histórico será preservado.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secundario" disabled={processando} onClick={() => setConfirmacao(null)}>
                Voltar
              </button>
              <button type="button" className="btn-perigo" disabled={processando} onClick={() => void cancelarReserva()}>
                {processando ? "Cancelando..." : "Sim, cancelar reserva"}
              </button>
            </div>
          </div>
        )}

        {/* Confirmação: liberar só esta ocorrência */}
        {!editando && confirmacao === "liberar" && (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm text-slate-700">
              Liberar somente a ocorrência de <strong>{formatarDataLonga(ocorrencia.data)}</strong>? As demais
              ocorrências da série continuam bloqueadas.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secundario" disabled={processando} onClick={() => setConfirmacao(null)}>
                Voltar
              </button>
              <button type="button" className="btn-primario" disabled={processando} onClick={() => void liberarOcorrencia()}>
                {processando ? "Liberando..." : "Sim, liberar esta ocorrência"}
              </button>
            </div>
          </div>
        )}

        {/* Confirmação dupla: encerrar a série (1 de 2) */}
        {!editando && confirmacao === "encerrar1" && (
          <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-800">
              Encerrar a série de horário fixo? (confirmação 1 de 2)
            </p>
            <p className="text-sm text-red-800">
              Esta ação bloqueia todas as ocorrências futuras da recorrência, não somente a de{" "}
              {formatarData(ocorrencia.data)}.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secundario" disabled={processando} onClick={() => setConfirmacao(null)}>
                Voltar
              </button>
              <button
                type="button"
                className="btn-perigo"
                disabled={processando}
                onClick={() => setConfirmacao("encerrar2")}
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Confirmação dupla: encerrar a série (2 de 2) */}
        {!editando && confirmacao === "encerrar2" && (
          <div className="space-y-3 rounded-lg border border-red-300 bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-800">
              Última confirmação (2 de 2): a série será encerrada agora.
            </p>
            <p className="text-sm text-red-800">Não é possível desfazer esta ação pela agenda.</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secundario" disabled={processando} onClick={() => setConfirmacao(null)}>
                Voltar
              </button>
              <button type="button" className="btn-perigo" disabled={processando} onClick={() => void encerrarSerie()}>
                {processando ? "Encerrando..." : "Sim, encerrar a série"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
