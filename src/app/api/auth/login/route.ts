import { cookies } from "next/headers";
import { autenticar, criarSessao, SESSION_COOKIE } from "@/lib/auth";
import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";

export async function POST(req: Request): Promise<Response> {
  try {
    const { email, senha } = await lerCorpo<{ email?: string; senha?: string }>(req);
    if (!email || !senha) return erro(400, "E-mail e senha são obrigatórios.");

    const sessao = autenticar(email, senha);
    if (!sessao) {
      return erro(401, "Credenciais inválidas.");
    }
    const token = await criarSessao(sessao);
    const store = await cookies();
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    registrarAuditoria(sessao.adminId, "login", "administrador", sessao.adminId, `${sessao.nome} entrou no painel.`);
    return ok({ ok: true, nome: sessao.nome });
  } catch (e) {
    return tratarErro(e);
  }
}
