"use client";

import { useCallback, useEffect, useState } from "react";

/* ---------------------------------------------------------------- tipos */

interface EventoAuditoria {
  id: number;
  admin: string;
  acao: string;
  entidade: string;
  entidade_id: number | null;
  resumo: string;
  quando: string;
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

/* ------------------------------------------------------------ utilidades */

const CORES_ACAO: Record<string, string> = {
  criar: "bg-blue-100 text-blue-800",
  cadastrar: "bg-blue-100 text-blue-800",
  editar: "bg-amber-100 text-amber-800",
  atualizar: "bg-amber-100 text-amber-800",
  excluir: "bg-red-100 text-red-800",
  remover: "bg-red-100 text-red-800",
  confirmar: "bg-green-100 text-green-800",
  recusar: "bg-orange-100 text-orange-800",
  pagar: "bg-green-100 text-green-800",
  estornar: "bg-orange-100 text-orange-800",
  entrar: "bg-slate-200 text-slate-700",
  sair: "bg-slate-200 text-slate-700",
};

const ROTULOS_ENTIDADE: Record<string, string> = {
  profissional: "Profissional",
  consultorio: "Consultório",
  foto: "Foto",
  preco: "Preço",
  solicitacao: "Solicitação",
  lancamento: "Lançamento",
  reserva: "Reserva",
  recorrencia: "Recorrência",
  admin: "Administrador",
};

function rotuloAcao(acao: string): string {
  return acao.charAt(0).toUpperCase() + acao.slice(1);
}

function rotuloEntidade(entidade: string): string {
  return ROTULOS_ENTIDADE[entidade] ?? entidade.charAt(0).toUpperCase() + entidade.slice(1);
}

/* -------------------------------------------------------------- página */

export default function PaginaAuditoria() {
  const [eventos, setEventos] = useState<EventoAuditoria[]>([]);
  const [limite, setLimite] = useState(200);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await requisicao<{ eventos: EventoAuditoria[] }>(
        `/api/admin/auditoria?limite=${limite}`
      );
      setEventos(dados.eventos);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setCarregando(false);
    }
  }, [limite]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function carregarMais(): Promise<void> {
    setCarregandoMais(true);
    setMensagem(null);
    const novoLimite = limite + 200;
    try {
      const dados = await requisicao<{ eventos: EventoAuditoria[] }>(
        `/api/admin/auditoria?limite=${novoLimite}`
      );
      setEventos(dados.eventos);
      setLimite(novoLimite);
    } catch (e) {
      setMensagem({ tipo: "erro", texto: mensagemDe(e) });
    } finally {
      setCarregandoMais(false);
    }
  }

  const podeCarregarMais = eventos.length >= limite;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Auditoria</h1>
        <p className="text-sm text-slate-500">
          Histórico de alterações do painel administrativo. Exibindo até {limite} registros.
        </p>
      </div>

      {mensagem && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {mensagem.texto}
        </p>
      )}

      {carregando ? (
        <p role="status" className="card p-6 text-center text-sm text-slate-500">
          Carregando registros de auditoria...
        </p>
      ) : erro ? (
        <div role="alert" className="card p-6 text-center">
          <p className="font-medium text-red-700">{erro}</p>
          <button type="button" className="btn-secundario mt-4" onClick={() => void carregar()}>
            Tentar novamente
          </button>
        </div>
      ) : eventos.length === 0 ? (
        <p className="card p-6 text-center text-sm text-slate-500">Nenhum registro de auditoria.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {eventos.map((ev) => (
              <li key={ev.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CORES_ACAO[ev.acao] ?? "bg-slate-100 text-slate-700"}`}
                    >
                      {rotuloAcao(ev.acao)}
                    </span>
                    <span className="text-sm font-medium text-slate-800">
                      {rotuloEntidade(ev.entidade)}
                      {ev.entidade_id !== null ? ` #${ev.entidade_id}` : ""}
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-sm text-slate-600">{ev.admin}</span>
                  </div>
                  <time className="text-xs text-slate-500">{ev.quando}</time>
                </div>
                <p className="mt-2 text-sm text-slate-700">{ev.resumo}</p>
              </li>
            ))}
          </ul>

          <div className="flex justify-center">
            {podeCarregarMais ? (
              <button
                type="button"
                className="btn-secundario"
                disabled={carregandoMais}
                onClick={() => void carregarMais()}
              >
                {carregandoMais ? "Carregando..." : "Carregar mais"}
              </button>
            ) : (
              <p className="text-sm text-slate-500">Fim do histórico.</p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
