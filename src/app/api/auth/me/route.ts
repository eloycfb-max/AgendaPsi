import { lerSessao } from "@/lib/auth";
import { ok } from "@/lib/http";

export async function GET(): Promise<Response> {
  const sessao = await lerSessao();
  return ok({ autenticado: !!sessao, sessao });
}
