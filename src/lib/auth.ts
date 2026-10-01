import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { getDb } from "./db";

export const SESSION_COOKIE = "hmps_sessao";
const SESSION_DURATION = "8h";

export interface Sessao {
  adminId: number;
  nome: string;
  email: string;
}

function getSecret(): Uint8Array {
  const dir = path.join(process.cwd(), "data");
  const arquivo = path.join(dir, "secret.key");
  if (!existsSync(arquivo)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(arquivo, randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  return new Uint8Array(Buffer.from(readFileSync(arquivo, "utf8").trim(), "hex"));
}

export async function criarSessao(sessao: Sessao): Promise<string> {
  return new SignJWT({ ...sessao })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecret());
}

export async function lerSessao(): Promise<Sessao | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      adminId: Number(payload.adminId),
      nome: String(payload.nome),
      email: String(payload.email),
    };
  } catch {
    return null;
  }
}

/** Protege uma rota administrativa: devolve a sessão ou lança 401. */
export async function exigirSessao(): Promise<Sessao> {
  const sessao = await lerSessao();
  if (!sessao) {
    throw new Response(JSON.stringify({ erro: "Sessão expirada ou não autenticada." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return sessao;
}

export function verificarSenha(senha: string, hash: string): boolean {
  return bcrypt.compareSync(senha, hash);
}

export function autenticar(email: string, senha: string): Sessao | null {
  const db = getDb();
  const linha = db
    .prepare("SELECT * FROM administradores WHERE email = ? AND situacao = 'ativo'")
    .get(email.toLowerCase().trim()) as Record<string, unknown> | undefined;
  if (!linha) return null;
  if (!verificarSenha(senha, String(linha.senha_hash))) return null;
  return { adminId: Number(linha.id), nome: String(linha.nome), email: String(linha.email) };
}

/** Aplica hash bcrypt à senha (uso em seed/rotas de troca de senha). */
export function hashSenha(senha: string): string {
  return bcrypt.hashSync(senha, 10);
}
