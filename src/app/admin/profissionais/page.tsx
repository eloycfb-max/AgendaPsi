"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { Indicador } from "@/components/Indicador";
import { DIAS_SEMANA, TIPOS_RESERVA } from "@/lib/constants";
import { formatarData, formatarHora } from "@/lib/dates";

/* ---------------------------------------------------------------- tipos */

interface Profissional {
  id: number;
  nome: string;
  profissao: string;
  telefone: string;
  email: string | null;
  situacao: string;
  observacoes: string | null;
}

interface ReservaHistorico {
  id: number;
  data: string;
  inicio: number;
  fim: number;
  tipo: string;
  situacao: string;
  consultorio: string;
}

interface RecorrenciaHistorico {
  id: number;
  dia_semana: number;
  inicio: number;
  data_inicio: string;
  data_fim: string | null;
  situacao: string;
  consultorio: string;
}

interface Historico {
  profissional: Profissional;
  reservas: ReservaHistorico[];
  recorrencias: RecorrenciaHistorico[];
}

interface FormProfissional {
  nome: string;
  profissao: string;
  telefone: string;
  email: string;
  observacoes: string;
  situacao: string;
}

interface Mensagem {
  tipo: "ok" | "erro";
  texto: string;
}

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

const FORM_VAZIO: FormProfissional = {
  nome: "",
  profissao: "",
  telefone: "",
  email: "",
  observacoes: "",
  situacao: "ativo",
};

function rotuloTipo(tipo: string): string {
  if (tipo === "fixo" || tipo === "avulsa" || tipo === "reposicao") return TIPOS_RESERVA[tipo].rotulo;
  return tipo;
}

function rotuloDia(numero: number): string {
  return DIAS_SEMANA.find((d) => d.numero === numero)?.longo ?? String(numero);
}

function capitalizar(valor: string): string {
  return valor.charAt(0).toUpperCase() + valor.slice(1);
}

/* -------------------------------------------------------------- página */

export default function PaginaProfissionais() {
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);

  // cadastro
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [form, setForm] = useState<FormProfissional>(FORM_VAZIO);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // edição
  const [editando, setEditando] = useState<Profissional | null>(null);

  // exclusão
  const [excluindo, setExcluindo] = useState<Profissional | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [processandoExclusao, setProcessandoExclusao] = useState(false);

  // histórico
  const [historicoDe, setHistoricoDe] = useState<Profissional | null>(null);
  const [historico, setHistorico] = useState<Historico | null>(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [erroHistorico, setErroHistorico] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    try {
      const dados = await requisicao<{ profissionais: Profissional[] }>(
        "/api/admin/profissionais?incluir_inativos=1"
      );
      setProfissionais(dados.profissionais);
    } catch (e) {
      setErroLista(mensagemDe(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return profissionais;
    return profissionais.filter((p) => p.nome.toLowerCase().includes(termo));
  }, [profissionais, busca]);

  const ativos = profissionais.filter((p) => p.situacao === "ativo").length;
  const inativos = profissionais.length - ativos;

  function abrirCadastro() {
    setForm(FORM_VAZIO);
    setErroForm(null);
    setCadastroAberto(true);
  }

  async function salvarCadastro(): Promise<void> {
    if (form.nome.trim().length < 3) {
      setErroForm("Nome completo é obrigatório (mínimo 3 caracteres).");
      return;
    }
    setSalvando(true);
    setErroForm(null);
    try {
      await requisicao("/api/admin/profissionais", corpoJson("POST", form));
      setCadastroAberto(false);
      setForm(FORM_VAZIO);
      setMensagem({ tipo: "ok", texto: "Profissional cadastrado com sucesso." });
      await carregar();
    } catch (e) {
      setErroForm(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  }

  function abrirEdicao(p: Profissional) {
    setForm({
      nome: p.nome,
      profissao: p.profissao,
      telefone: p.telefone,
      email: p.email ?? "",
      observacoes: p.observacoes ?? "",
      situacao: p.situacao,
    });
    setErroForm(null);
    setEditando(p);
  }

  async function salvarEdicao(): Promise<void> {
    if (!editando) return;
    if (form.nome.trim().length < 3) {
      setErroForm("Nome completo é obrigatório (mínimo 3 caracteres).");
      return;
    }
    setSalvando(true);
    setErroForm(null);
    try {
      await requisicao(`/api/admin/profissionais/${editando.id}`, corpoJson("PUT", form));
      setEditando(null);
      setMensagem({ tipo: "ok", texto: "Cadastro atualizado." });
      await carregar();
    } catch (e) {
      setErroForm(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  }

  /** Envia o cadastro completo: a API apaga campos omitidos. */
  async function trocarSituacao(p: Profissional, situacao: "ativo" | "inativo"): Promise<void> {
    try {
      await requisicao(
        `/api/admin/profissionais/${p.id}`,
        corpoJson("PUT", {
          nome: p.nome,
          profissao: p.profissao,
          telefone: p.telefone,
          email: p.email ?? "",
          situacao,
          observacoes: p.observacoes ?? "",
        })
      );
      setMensagem({
        tipo: "ok",
        texto: situacao === "inativo" ? `${p.nome} foi inativado.` : `${p.nome} foi reativado.`,
      });
      await carregar();
    } catch (e) {
      setMensagem({ tipo: "erro", texto: mensagemDe(e) });
    }
  }

  function pedirExclusao(p: Profissional) {
    setErroExclusao(null);
    setProcessandoExclusao(false);
    setExcluindo(p);
  }

  async function confirmarExclusao(): Promise<void> {
    if (!excluindo) return;
    setProcessandoExclusao(true);
    setErroExclusao(null);
    try {
      await requisicao(`/api/admin/profissionais/${excluindo.id}`, { method: "DELETE" });
      setMensagem({ tipo: "ok", texto: "Profissional excluído." });
      setExcluindo(null);
      await carregar();
    } catch (e) {
      if (e instanceof RequisicaoErro && e.status === 409) {
        setErroExclusao("Possui reservas ou registros financeiros — inative em vez de excluir.");
      } else {
        setErroExclusao(mensagemDe(e));
      }
    } finally {
      setProcessandoExclusao(false);
    }
  }

  async function inativarAPartirDaExclusao(): Promise<void> {
    if (!excluindo) return;
    const p = excluindo;
    setExcluindo(null);
    await trocarSituacao(p, "inativo");
  }

  async function abrirHistorico(p: Profissional): Promise<void> {
    setHistoricoDe(p);
    setHistorico(null);
    setErroHistorico(null);
    setCarregandoHistorico(true);
    try {
      const dados = await requisicao<Historico>(`/api/admin/profissionais/${p.id}`);
      setHistorico(dados);
    } catch (e) {
      setErroHistorico(mensagemDe(e));
    } finally {
      setCarregandoHistorico(false);
    }
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Profissionais</h1>
          <p className="text-sm text-slate-500">
            Cadastro dos profissionais que utilizam os consultórios.
          </p>
        </div>
        <button type="button" className="btn-primario" onClick={abrirCadastro}>
          Novo profissional
        </button>
      </div>

      <section aria-label="Indicadores de profissionais" className="grid gap-3 sm:grid-cols-3">
        <Indicador rotulo="Total" valor={String(profissionais.length)} />
        <Indicador rotulo="Ativos" valor={String(ativos)} tom="positivo" />
        <Indicador rotulo="Inativos" valor={String(inativos)} />
      </section>

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

      <section className="card p-4" aria-label="Busca de profissionais">
        <label className="rotulo" htmlFor="busca-profissionais">
          Buscar por nome
        </label>
        <input
          id="busca-profissionais"
          type="search"
          className="campo"
          placeholder="Digite o nome do profissional"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </section>

      {carregando ? (
        <p role="status" className="card p-6 text-center text-sm text-slate-500">
          Carregando profissionais...
        </p>
      ) : erroLista ? (
        <div role="alert" className="card p-6 text-center">
          <p className="font-medium text-red-700">{erroLista}</p>
          <button type="button" className="btn-secundario mt-4" onClick={() => void carregar()}>
            Tentar novamente
          </button>
        </div>
      ) : filtrados.length === 0 ? (
        <p className="card p-6 text-center text-sm text-slate-500">
          {profissionais.length === 0 ? "Nenhum profissional cadastrado" : "Nenhum profissional encontrado para a busca."}
        </p>
      ) : (
        <ul className="grid gap-3">
          {filtrados.map((p) => (
            <li key={p.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-900">{p.nome}</h2>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.situacao === "ativo" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${
                          p.situacao === "ativo" ? "bg-green-600" : "bg-slate-400"
                        }`}
                      />
                      {p.situacao === "ativo" ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {p.profissao || "Profissão não informada"}
                    {p.telefone ? ` · ${p.telefone}` : ""}
                  </p>
                  {(p.email || p.observacoes) && (
                    <p className="mt-0.5 text-sm text-slate-500">
                      {[p.email, p.observacoes].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secundario" onClick={() => abrirEdicao(p)}>
                    Editar
                  </button>
                  <button type="button" className="btn-secundario" onClick={() => void abrirHistorico(p)}>
                    Histórico
                  </button>
                  {p.situacao === "ativo" ? (
                    <button type="button" className="btn-secundario" onClick={() => void trocarSituacao(p, "inativo")}>
                      Inativar
                    </button>
                  ) : (
                    <button type="button" className="btn-secundario" onClick={() => void trocarSituacao(p, "ativo")}>
                      Reativar
                    </button>
                  )}
                  <button type="button" className="btn-perigo" onClick={() => pedirExclusao(p)}>
                    Excluir
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Cadastro */}
      <Modal
        aberto={cadastroAberto}
        aoFechar={() => setCadastroAberto(false)}
        titulo="Novo profissional"
        descricao="Preencha os dados do profissional."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void salvarCadastro();
          }}
        >
          <div>
            <label className="rotulo" htmlFor="cad-nome">
              Nome completo *
            </label>
            <input
              id="cad-nome"
              className="campo"
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="cad-profissao">
              Profissão / especialidade
            </label>
            <input
              id="cad-profissao"
              className="campo"
              placeholder="Psicóloga, Terapeuta cognitivo..."
              value={form.profissao}
              onChange={(e) => setForm({ ...form, profissao: e.target.value })}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="cad-telefone">
              Telefone
            </label>
            <input
              id="cad-telefone"
              className="campo"
              type="tel"
              placeholder="(21) 99999-9999"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="cad-email">
              E-mail (opcional)
            </label>
            <input
              id="cad-email"
              className="campo"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="cad-observacoes">
              Observações
            </label>
            <textarea
              id="cad-observacoes"
              className="campo"
              rows={3}
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>
          {erroForm && (
            <p role="alert" className="text-sm text-red-700">
              {erroForm}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secundario" onClick={() => setCadastroAberto(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primario" disabled={salvando}>
              {salvando ? "Salvando..." : "Cadastrar"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edição */}
      <Modal
        aberto={editando !== null}
        aoFechar={() => setEditando(null)}
        titulo="Editar profissional"
        descricao={editando ? editando.nome : undefined}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void salvarEdicao();
          }}
        >
          <div>
            <label className="rotulo" htmlFor="edt-nome">
              Nome completo *
            </label>
            <input
              id="edt-nome"
              className="campo"
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="edt-profissao">
              Profissão / especialidade
            </label>
            <input
              id="edt-profissao"
              className="campo"
              value={form.profissao}
              onChange={(e) => setForm({ ...form, profissao: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="edt-telefone">
                Telefone
              </label>
              <input
                id="edt-telefone"
                className="campo"
                type="tel"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="edt-email">
                E-mail (opcional)
              </label>
              <input
                id="edt-email"
                className="campo"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="rotulo" htmlFor="edt-situacao">
              Situação
            </label>
            <select
              id="edt-situacao"
              className="campo"
              value={form.situacao}
              onChange={(e) => setForm({ ...form, situacao: e.target.value })}
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="edt-observacoes">
              Observações
            </label>
            <textarea
              id="edt-observacoes"
              className="campo"
              rows={3}
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>
          {erroForm && (
            <p role="alert" className="text-sm text-red-700">
              {erroForm}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {editando && editando.situacao === "ativo" && (
              <button
                type="button"
                className="btn-perigo"
                disabled={salvando}
                onClick={() => setForm({ ...form, situacao: "inativo" })}
              >
                Inativar
              </button>
            )}
            <button type="button" className="btn-secundario" onClick={() => setEditando(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primario" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Exclusão */}
      <Modal
        aberto={excluindo !== null}
        aoFechar={() => setExcluindo(null)}
        titulo="Excluir profissional"
        descricao={excluindo ? excluindo.nome : undefined}
        largura="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Esta ação remove definitivamente o cadastro. Confirma a exclusão de{" "}
            <strong>{excluindo?.nome}</strong>?
          </p>
          {erroExclusao && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <p>{erroExclusao}</p>
              <button type="button" className="btn-perigo mt-3" onClick={() => void inativarAPartirDaExclusao()}>
                Inativar em vez de excluir
              </button>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secundario" onClick={() => setExcluindo(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-perigo"
              disabled={processandoExclusao}
              onClick={() => void confirmarExclusao()}
            >
              {processandoExclusao ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Histórico */}
      <Modal
        aberto={historicoDe !== null}
        aoFechar={() => setHistoricoDe(null)}
        titulo="Histórico do profissional"
        descricao={historicoDe ? historicoDe.nome : undefined}
        largura="lg"
      >
        {carregandoHistorico ? (
          <p role="status" className="text-sm text-slate-500">
            Carregando histórico...
          </p>
        ) : erroHistorico ? (
          <div role="alert" className="space-y-3">
            <p className="text-sm text-red-700">{erroHistorico}</p>
            <button
              type="button"
              className="btn-secundario"
              onClick={() => {
                if (historicoDe) void abrirHistorico(historicoDe);
              }}
            >
              Tentar novamente
            </button>
          </div>
        ) : historico ? (
          <div className="space-y-5">
            <p className="text-sm text-slate-600">
              {[historico.profissional.profissao, historico.profissional.telefone, historico.profissional.email]
                .filter(Boolean)
                .join(" · ") || "Sem informações complementares."}
            </p>

            <section aria-label="Reservas">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Reservas ({historico.reservas.length})
              </h3>
              {historico.reservas.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma reserva registrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Data
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Horário
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Consultório
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Tipo
                        </th>
                        <th scope="col" className="py-2 font-medium">
                          Situação
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {historico.reservas.map((r) => (
                        <tr key={r.id} className="border-b border-slate-100">
                          <td className="py-2 pr-3">{formatarData(r.data)}</td>
                          <td className="py-2 pr-3">{formatarHora(r.inicio, r.fim)}</td>
                          <td className="py-2 pr-3">{r.consultorio}</td>
                          <td className="py-2 pr-3">{rotuloTipo(r.tipo)}</td>
                          <td className="py-2">{capitalizar(r.situacao)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section aria-label="Recorrências">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Recorrências ({historico.recorrencias.length})
              </h3>
              {historico.recorrencias.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma recorrência registrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Dia
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Horário
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Vigência
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Consultório
                        </th>
                        <th scope="col" className="py-2 font-medium">
                          Situação
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {historico.recorrencias.map((r) => (
                        <tr key={r.id} className="border-b border-slate-100">
                          <td className="py-2 pr-3">{rotuloDia(r.dia_semana)}</td>
                          <td className="py-2 pr-3">{formatarHora(r.inicio, r.inicio + 1)}</td>
                          <td className="py-2 pr-3">
                            {formatarData(r.data_inicio)} a{" "}
                            {r.data_fim ? formatarData(r.data_fim) : "em aberto"}
                          </td>
                          <td className="py-2 pr-3">{r.consultorio}</td>
                          <td className="py-2">{capitalizar(r.situacao)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </Modal>
    </main>
  );
}
