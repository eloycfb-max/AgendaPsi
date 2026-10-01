import { cookies } from "next/headers";
import { SESSION_COOKIE, lerSessao } from "@/lib/auth";
import { ok, tratarErro } from "@/lib/http";

export async function POST(): Promise<Response> {
  try {
    const sessao = await lerSessao();
    const store = await cookies();
    store.delete(SESSION_COOKIE);
    return ok({ ok: true, nome: sessao?.nome ?? null });
  } catch (e) {
    return tratarErro(e);
  }
}
