/**
 * Helper de rede usado pelas telas do painel administrativo.
 *
 * - Em 401 (sessão expirada/ausente) redireciona para /login?expirada=1;
 * - Normaliza erros de conexão e de API em `RequisicaoErro`;
 * - Repassa o corpo do 409 (`conflito`, `data`) para exibir o conflito.
 */

export class RequisicaoErro extends Error {
  readonly status: number;
  readonly conflito: boolean;
  readonly dataConflito: string | null;

  constructor(status: number, mensagem: string, conflito = false, dataConflito: string | null = null) {
    super(mensagem);
    this.name = "RequisicaoErro";
    this.status = status;
    this.conflito = conflito;
    this.dataConflito = dataConflito;
  }
}

/** Mensagem amigável para qualquer erro capturado. */
export function mensagemDe(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Erro inesperado.";
}

/** Monta o init de uma requisição JSON. */
export function jsonInit(metodo: "POST" | "PUT" | "DELETE", dados?: unknown): RequestInit {
  return {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados ?? {}),
  };
}

/** Fetch autenticado do painel: 401 leva a /login?expirada=1. */
export async function fetchAdmin<T>(url: string, init?: RequestInit): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(url, init);
  } catch {
    throw new RequisicaoErro(0, "Falha na conexão. Verifique sua internet e tente novamente.");
  }

  if (resposta.status === 401) {
    window.location.assign("/login?expirada=1");
    throw new RequisicaoErro(401, "Sessão expirada.");
  }

  let dados: unknown = null;
  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }

  const corpo: { erro?: unknown; conflito?: unknown; data?: unknown } =
    dados && typeof dados === "object" ? (dados as { erro?: unknown; conflito?: unknown; data?: unknown }) : {};

  if (!resposta.ok) {
    const mensagem =
      typeof corpo.erro === "string" ? corpo.erro : `Erro ${resposta.status} ao processar a solicitação.`;
    throw new RequisicaoErro(
      resposta.status,
      mensagem,
      corpo.conflito === true,
      typeof corpo.data === "string" ? corpo.data : null
    );
  }

  return dados as T;
}
