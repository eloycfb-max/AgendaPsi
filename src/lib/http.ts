import { ConflitoError } from "./schedule";

export function ok(dados: unknown, init?: ResponseInit): Response {
  return Response.json(dados, init);
}

export function erro(status: number, mensagem: string, extra?: Record<string, unknown>): Response {
  return Response.json({ erro: mensagem, ...extra }, { status });
}

export async function lerCorpo<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("Corpo da requisição inválido.");
  }
}

/** Erro de regra de negócio que deve ser comunicado como 400 ao cliente. */
export class ValidacaoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ValidacaoError";
  }
}

/** Tratamento padrão de erros das rotas administrativas. */
export function tratarErro(e: unknown): Response {
  if (e instanceof Response) return e;
  if (e instanceof ConflitoError) {
    return erro(409, e.message, { conflito: true });
  }
  if (e instanceof ValidacaoError) {
    return erro(400, e.message);
  }
  const msg = e instanceof Error ? e.message : "Erro inesperado.";
  if (msg.includes("inválid") || msg.includes("deve ") || msg.includes("obrigat")) {
    return erro(400, msg);
  }
  console.error("[api]", e);
  return erro(500, msg);
}
