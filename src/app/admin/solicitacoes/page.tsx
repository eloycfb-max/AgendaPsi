"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { TIPOS_RESERVA, horariosValidos } from "@/lib/constants";
import { formatarDataHora, formatarDataLonga, formatarHora, hojeIso } from "@/lib/dates";

/* ---------------------------------------------------------------- tipos */

interface Solicitacao {
  id: number;
  nome: string;
  telefone: string;
  consultorio_id: number;
  nome_consultorio: string;
  data: string;
  inicio: number;
  fim: number;
  tipo: string;
  situacao: string;
  observacoes: string | null;
  created_at: string;
}

interface Profissional {
  id: number;
  nome: string;
  situacao: string;
}

interface Consultorio {
  id: number;
  nome: string;
}

interface FormConfirmar {
  profissional_id: string;
  tipo: string;
  valor: string;
  vencimento: string;
}

interface FormManual {
  nome: string;
  telefone: string;
  consultorio_id: string;
  data: string;
  inicio: string;
  tipo: string;
  observacoes: string;
}

interface Mensagem {
  tipo: "ok" | "erro";
  texto: string;
}

type FiltroSituacao = "todas" | "pendente" | "confirmada" | "recusada";

/* ------------------------------------------------------- helper de rede */

class RequisicaoErro extends Error {
  readonly status: number;

  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.name = "RequisicaoErro";
    this.status = status;
  }
}

function mensagemDe(e: unknown): string {
  return e instanceof Error ? e.message : "Erro inesperado.";
}

async function requisicao<T>(url: string, init?: RequestInit): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(url, init);
  } catch {
    throw new RequisicaoErro(0, "Falha na conexão");
  }
  if (resposta.status === 401) {
    window.location.href = "/login?expirada=1";
    throw new RequisicaoErro(401, "Sessão expirada.");
  }
  let dados: unknown = null;
  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }
  if (!resposta.ok) {
    const corpo = dados as { erro?: unknown } | null;
    const mensagem =
      corpo && typeof corpo.erro === "string" ? corpo.erro : `Erro ${resposta.status} ao processar a solicitação.`;
    throw new RequisicaoErro(resposta.status, mensagem);
  }
  return dados as T;
}

function corpoJson(metodo: string, dados: unknown): RequestInit {
  return {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  };
}

/* ------------------------------------------------------------ utilidades */

function rotuloTipo(tipo: string): string {
  if (tipo === "fixo" || tipo === "avulsa" || tipo === "reposicao") return TIPOS_RESERVA[tipo].rotulo;
  return tipo;
}

/** "https://wa.me/55" + número apenas com dígitos */
function linkWhatsApp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  const numero = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${numero}`;
}

function classeSituacao(situacao: string): string {
  if (situacao === "confirmada") return "bg-green-100 text-green-800";
  if (situacao === "recusada") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

function rotuloSituacao(situacao: string): string {
  if (situacao === "confirmada") return "Confirmada";
  if (situacao === "recusada") return "Recusada";
  return "Pendente";
}

const FORM_CONFIRMAR_VAZIO: FormConfirmar = {
  profissional_id: "",
  tipo: "avulsa",
  valor: "",
  vencimento: "",
};

const FORM_MANUAL_VAZIO: FormManual = {
  nome: "",
  telefone: "",
  consultorio_id: "",
  data: hojeIso(),
  inicio: "07",
  tipo: "avulsa",
  observacoes: "",
};

/* -------------------------------------------------------------- página */

export default function PaginaSolicitacoes() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [consultorios, setConsultorios] = useState<Consultorio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [erroApoio, setErroApoio] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroSituacao>("todas");
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);

  // confirmar
  const [confirmando, setConfirmando] = useState<Solicitacao | null>(null);
  const [formConf, setFormConf] = useState<FormConfirmar>(FORM_CONFIRMAR_VAZIO);
  const [erroConf, setErroConf] = useState<string | null>(null);
  const [conflitoConf, setConflitoConf] = useState<string | null>(null);
  const [sucessoConf, setSucessoConf] = useState<{ texto: string; detalhe?: string } | null>(null);
  const [salvandoConf, setSalvandoConf] = useState(false);

  // recusar
  const [recusando, setRecusando] = useState<Solicitacao | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erroRecusa, setErroRecusa] = useState<string | null>(null);
  const [salvandoRecusa, setSalvandoRecusa] = useState(false);

  // registro manual
  const [manualAberto, setManualAberto] = useState(false);
  const [formManual, setFormManual] = useState<FormManual>(FORM_MANUAL_VAZIO);
  const [erroManual, setErroManual] = useState<string | null>(null);
  const [salvandoManual, setSalvandoManual] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    try {
      const dados = await requisicao<{ solicitacoes: Solicitacao[] }>("/api/admin/solicitacoes?situacao=todas");
      setSolicitacoes(dados.solicitacoes);
    } catch (e) {
      setErroLista(mensagemDe(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  const carregarApoio = useCallback(async () => {
    try {
      const [profs, salas] = await Promise.all([
        requisicao<{ profissionais: Profissional[] }>("/api/admin/profissionais"),
        requisicao<{ consultorios: Consultorio[] }>("/api/admin/consultorios"),
      ]);
      setProfissionais(profs.profissionais);
      setConsultorios(salas.consultorios);
      setErroApoio(null);
    } catch (e) {
      setErroApoio(mensagemDe(e));
    }
  }, []);

  useEffect(() => {
    void carregar();
    void carregarApoio();
  }, [carregar, carregarApoio]);

  const filtradas = useMemo(() => {
    const base = filtro === "todas" ? solicitacoes : solicitacoes.filter((s) => s.situacao === filtro);
    return [...base].sort((a, b) => {
      const pa = a.situacao === "pendente" ? 0 : 1;
      const pb = b.situacao === "pendente" ? 0 : 1;
      return pa - pb;
    });
  }, [solicitacoes, filtro]);

  const pendentes = solicitacoes.filter((s) => s.situacao === "pendente").length;

  /* --------------------------------------------------------- confirmar */

  function abrirConfirmar(s: Solicitacao): void {
    setFormConf({
      ...FORM_CONFIRMAR_VAZIO,
      profissional_id: profissionais.length > 0 ? String(profissionais[0].id) : "",
      tipo: s.tipo,
    });
    setErroConf(null);
    setConflitoConf(null);
    setSucessoConf(null);
    setConfirmando(s);
  }

  async function confirmar(): Promise<void> {
    if (!confirmando) return;
    if (!formConf.profissional_id) {
      setErroConf("Selecione o profissional para confirmar.");
      return;
    }
    setSalvandoConf(true);
    setErroConf(null);
    setConflitoConf(null);
    try {
      const dados = await requisicao<{ criado: { tipo: string; id: number } }>(
        `/api/admin/solicitacoes/${confirmando.id}/confirmar`,
        corpoJson("POST", {
          profissional_id: Number(formConf.profissional_id),
          tipo: formConf.tipo,
          valor: formConf.valor.trim() || undefined,
          vencimento: formConf.vencimento || undefined,
        })
      );
      setSucessoConf(
        dados.criado.tipo === "recorrencia"
          ? { texto: "Reserva confirmada", detalhe: "A recorrência semanal foi criada a partir da data solicitada." }
          : { texto: "Reserva confirmada" }
      );
      await carregar();
    } catch (e) {
      if (e instanceof RequisicaoErro && e.status === 409) {
        setConflitoConf("Horário já foi ocupado — escolha outro");
      } else {
        setErroConf(mensagemDe(e));
      }
    } finally {
      setSalvandoConf(false);
    }
  }

  /* ----------------------------------------------------------- recusar */

  function abrirRecusa(s: Solicitacao): void {
    setMotivo("");
    setErroRecusa(null);
    setRecusando(s);
  }

  async function recusar(): Promise<void> {
    if (!recusando) return;
    setSalvandoRecusa(true);
    setErroRecusa(null);
    try {
      await requisicao(`/api/admin/solicitacoes/${recusando.id}/recusar`, corpoJson("POST", { motivo: motivo.trim() }));
      setRecusando(null);
      setMensagem({ tipo: "ok", texto: "Solicitação recusada." });
      await carregar();
    } catch (e) {
      if (e instanceof RequisicaoErro && e.status === 409) {
        setErroRecusa("Esta solicitação já foi tratada.");
      } else {
        setErroRecusa(mensagemDe(e));
      }
    } finally {
      setSalvandoRecusa(false);
    }
  }

  /* ------------------------------------------------ registro manual */

  function abrirManual(): void {
    setFormManual(FORM_MANUAL_VAZIO);
    setErroManual(null);
    setManualAberto(true);
  }

  async function salvarManual(): Promise<void> {
    if (formManual.nome.trim().length < 3) {
      setErroManual("Nome do interessado é obrigatório.");
      return;
    }
    if (formManual.telefone.replace(/\D/g, "").length < 10) {
      setErroManual("Telefone inválido — informe o número com DDD.");
      return;
    }
    if (!formManual.consultorio_id) {
      setErroManual("Selecione o consultório.");
      return;
    }
    if (!formManual.data) {
      setErroManual("Informe a data solicitada.");
      return;
    }
    setSalvandoManual(true);
    setErroManual(null);
    try {
      await requisicao(
        "/api/admin/solicitacoes",
        corpoJson("POST", {
          nome: formManual.nome.trim(),
          telefone: formManual.telefone.trim(),
          consultorio_id: Number(formManual.consultorio_id),
          data: formManual.data,
          inicio: Number(formManual.inicio),
          tipo: formManual.tipo,
          observacoes: formManual.observacoes.trim(),
        })
      );
      setManualAberto(false);
      setMensagem({ tipo: "ok", texto: "Solicitação registrada com sucesso." });
      await carregar();
    } catch (e) {
      setErroManual(mensagemDe(e));
    } finally {
      setSalvandoManual(false);
    }
  }

  /* ---------------------------------------------------------- render */

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Solicitações</h1>
          <p className="text-sm text-slate-500">
            Pedidos recebidos pelo site e pelo WhatsApp.
          </p>
        </div>
        <button type="button" className="btn-primario" onClick={abrirManual}>
          Registrar solicitação manual
        </button>
      </div>

      {mensagem && (
        <p
          role={mensagem.tipo === "ok" ? "status" : "alert"}
          className={`rounded-lg border px-4 py-3 text-sm ${
            mensagem.tipo === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {mensagem.texto}
        </p>
      )}

      <section className="card p-4" aria-label="Filtros de solicitações">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="rotulo" htmlFor="filtro-situacao">
              Situação
            </label>
            <select
              id="filtro-situacao"
              className="campo"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as FiltroSituacao)}
            >
              <option value="todas">Todas</option>
              <option value="pendente">Pendentes</option>
              <option value="confirmada">Confirmadas</option>
              <option value="recusada">Recusadas</option>
            </select>
          </div>
          <p className="pb-2 text-sm text-slate-500">
            {pendentes} pendente{pendentes === 1 ? "" : "s"} aguardando análise
          </p>
        </div>
      </section>

      {erroApoio && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{erroApoio}</span>
          <button type="button" className="btn-secundario" onClick={() => void carregarApoio()}>
            Tentar novamente
          </button>
        </div>
      )}

      {carregando ? (
        <p role="status" className="card p-6 text-center text-sm text-slate-500">
          Carregando solicitações...
        </p>
      ) : erroLista ? (
        <div role="alert" className="card p-6 text-center">
          <p className="font-medium text-red-700">{erroLista}</p>
          <button type="button" className="btn-secundario mt-4" onClick={() => void carregar()}>
            Tentar novamente
          </button>
        </div>
      ) : filtradas.length === 0 ? (
        <p className="card p-6 text-center text-sm text-slate-500">Nenhuma solicitação</p>
      ) : (
        <ul className="grid gap-3">
          {filtradas.map((s) => (
            <li key={s.id}>
              <article className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-900">{s.nome}</h2>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${classeSituacao(s.situacao)}`}
                      >
                        {rotuloSituacao(s.situacao)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      <a
                        href={linkWhatsApp(s.telefone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-petroleo-700 underline-offset-2 hover:underline"
                        aria-label={`Conversar com ${s.nome} no WhatsApp`}
                      >
                        {s.telefone}
                      </a>
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">Entrou em {formatarDataHora(s.created_at)}</p>
                </div>

                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="flex gap-2">
                    <dt className="font-medium text-slate-500">Consultório:</dt>
                    <dd className="text-slate-800">{s.nome_consultorio}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium text-slate-500">Horário:</dt>
                    <dd className="text-slate-800">{formatarHora(s.inicio, s.fim)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium text-slate-500">Data:</dt>
                    <dd className="text-slate-800">{formatarDataLonga(s.data)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium text-slate-500">Tipo:</dt>
                    <dd className="text-slate-800">{rotuloTipo(s.tipo)}</dd>
                  </div>
                  {s.observacoes && (
                    <div className="flex gap-2 sm:col-span-2">
                      <dt className="font-medium text-slate-500">Observações:</dt>
                      <dd className="text-slate-700">{s.observacoes}</dd>
                    </div>
                  )}
                </dl>

                {s.situacao === "pendente" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" className="btn-primario" onClick={() => abrirConfirmar(s)}>
                      Confirmar
                    </button>
                    <button type="button" className="btn-perigo" onClick={() => abrirRecusa(s)}>
                      Recusar
                    </button>
                  </div>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}

      {/* ------------------------------------------------------ confirmar */}
      <Modal
        aberto={confirmando !== null}
        aoFechar={() => setConfirmando(null)}
        titulo="Confirmar solicitação"
        descricao={
          confirmando ? `${confirmando.nome} — ${formatarDataLonga(confirmando.data)}` : undefined
        }
      >
        {sucessoConf ? (
          <div className="space-y-4">
            <div
              role="status"
              className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800"
            >
              {sucessoConf.texto}
              {sucessoConf.detalhe && <p className="mt-1 font-normal">{sucessoConf.detalhe}</p>}
            </div>
            <div className="flex justify-end">
              <button type="button" className="btn-primario" onClick={() => setConfirmando(null)}>
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void confirmar();
            }}
          >
            <div>
              <label className="rotulo" htmlFor="conf-profissional">
                Profissional *
              </label>
              <select
                id="conf-profissional"
                className="campo"
                required
                value={formConf.profissional_id}
                onChange={(e) => setFormConf({ ...formConf, profissional_id: e.target.value })}
              >
                <option value="">Selecione...</option>
                {profissionais.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
              {profissionais.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  Nenhum profissional ativo cadastrado. Cadastre em Profissionais antes de confirmar.
                </p>
              )}
            </div>

            <fieldset>
              <legend className="rotulo">Tipo de reserva</legend>
              <div className="flex flex-wrap gap-4">
                {(["fixo", "avulsa", "reposicao"] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="tipo-reserva"
                      value={t}
                      checked={formConf.tipo === t}
                      onChange={() => setFormConf({ ...formConf, tipo: t })}
                    />
                    {TIPOS_RESERVA[t].rotulo}
                  </label>
                ))}
              </div>
              {formConf.tipo === "fixo" && (
                <p className="mt-2 rounded-lg border border-petroleo-200 bg-petroleo-50 px-3 py-2 text-xs text-petroleo-800">
                  Ao confirmar, será criada uma recorrência semanal ocupando esse horário toda semana, a partir de{" "}
                  {confirmando ? formatarDataLonga(confirmando.data) : "a data solicitada"}.
                </p>
              )}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="rotulo" htmlFor="conf-valor">
                  Valor acordado (opcional)
                </label>
                <input
                  id="conf-valor"
                  className="campo"
                  inputMode="decimal"
                  placeholder="120,00"
                  value={formConf.valor}
                  onChange={(e) => setFormConf({ ...formConf, valor: e.target.value })}
                  aria-describedby="conf-valor-ajuda"
                />
                <p id="conf-valor-ajuda" className="mt-1 text-xs text-slate-500">
                  Em branco = sem lançamento financeiro.
                </p>
              </div>
              <div>
                <label className="rotulo" htmlFor="conf-vencimento">
                  Vencimento (opcional)
                </label>
                <input
                  id="conf-vencimento"
                  className="campo"
                  type="date"
                  value={formConf.vencimento}
                  onChange={(e) => setFormConf({ ...formConf, vencimento: e.target.value })}
                />
              </div>
            </div>

            {conflitoConf && (
              <div
                role="alert"
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
              >
                {conflitoConf}
                <p className="mt-1 font-normal text-red-700">
                  A solicitação continua pendente — escolha outro horário ou cancele a reserva que ocupa o espaço.
                </p>
              </div>
            )}
            {erroConf && (
              <p role="alert" className="text-sm text-red-700">
                {erroConf}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secundario" onClick={() => setConfirmando(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn-primario" disabled={salvandoConf}>
                {salvandoConf ? "Confirmando..." : "Confirmar"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* -------------------------------------------------------- recusar */}
      <Modal
        aberto={recusando !== null}
        aoFechar={() => setRecusando(null)}
        titulo="Recusar solicitação"
        descricao={recusando ? recusando.nome : undefined}
        largura="sm"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void recusar();
          }}
        >
          <div>
            <label className="rotulo" htmlFor="recusa-motivo">
              Motivo (opcional)
            </label>
            <textarea
              id="recusa-motivo"
              className="campo"
              rows={3}
              placeholder="Ex.: consultório indisponível no horário"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          {erroRecusa && (
            <p role="alert" className="text-sm text-red-700">
              {erroRecusa}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secundario" onClick={() => setRecusando(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-perigo" disabled={salvandoRecusa}>
              {salvandoRecusa ? "Recusando..." : "Recusar"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------- registro manual */}
      <Modal
        aberto={manualAberto}
        aoFechar={() => setManualAberto(false)}
        titulo="Registrar solicitação manual"
        descricao="Use para pedidos recebidos presencialmente ou por outro canal."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void salvarManual();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="man-nome">
                Nome do interessado *
              </label>
              <input
                id="man-nome"
                className="campo"
                required
                value={formManual.nome}
                onChange={(e) => setFormManual({ ...formManual, nome: e.target.value })}
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="man-telefone">
                Telefone *
              </label>
              <input
                id="man-telefone"
                className="campo"
                type="tel"
                placeholder="(21) 99999-9999"
                required
                value={formManual.telefone}
                onChange={(e) => setFormManual({ ...formManual, telefone: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="rotulo" htmlFor="man-consultorio">
              Consultório *
            </label>
            <select
              id="man-consultorio"
              className="campo"
              required
              value={formManual.consultorio_id}
              onChange={(e) => setFormManual({ ...formManual, consultorio_id: e.target.value })}
            >
              <option value="">Selecione...</option>
              {consultorios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="man-data">
                Data *
              </label>
              <input
                id="man-data"
                className="campo"
                type="date"
                required
                value={formManual.data}
                onChange={(e) => setFormManual({ ...formManual, data: e.target.value })}
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="man-inicio">
                Horário *
              </label>
              <select
                id="man-inicio"
                className="campo"
                value={formManual.inicio}
                onChange={(e) => setFormManual({ ...formManual, inicio: e.target.value })}
              >
                {horariosValidos().map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="rotulo" htmlFor="man-tipo">
              Tipo de reserva
            </label>
            <select
              id="man-tipo"
              className="campo"
              value={formManual.tipo}
              onChange={(e) => setFormManual({ ...formManual, tipo: e.target.value })}
            >
              <option value="fixo">{TIPOS_RESERVA.fixo.rotulo}</option>
              <option value="avulsa">{TIPOS_RESERVA.avulsa.rotulo}</option>
              <option value="reposicao">{TIPOS_RESERVA.reposicao.rotulo}</option>
            </select>
          </div>

          <div>
            <label className="rotulo" htmlFor="man-observacoes">
              Observações
            </label>
            <textarea
              id="man-observacoes"
              className="campo"
              rows={3}
              value={formManual.observacoes}
              onChange={(e) => setFormManual({ ...formManual, observacoes: e.target.value })}
            />
          </div>

          {erroManual && (
            <p role="alert" className="text-sm text-red-700">
              {erroManual}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secundario" onClick={() => setManualAberto(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primario" disabled={salvandoManual}>
              {salvandoManual ? "Salvando..." : "Registrar solicitação"}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
