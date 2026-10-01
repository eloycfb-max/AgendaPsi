"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/* ------------------------------------------------------- aviso de sessão */

function AvisoSessaoExpirada() {
  const searchParams = useSearchParams();
  if (searchParams.get("expirada") !== "1") return null;
  return (
    <p
      role="status"
      className="mb-4 rounded-lg border border-amarelo-300 bg-amarelo-100 px-4 py-3 text-sm text-slate-800"
    >
      Sua sessão expirou, entre novamente.
    </p>
  );
}

/* ------------------------------------------------------------ formulário */

function FormularioLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      if (resposta.status === 401) {
        setErro("E-mail ou senha incorretos. Verifique os dados e tente novamente.");
        return;
      }
      if (!resposta.ok) {
        let mensagem = "Erro ao entrar. Tente novamente.";
        try {
          const corpo = (await resposta.json()) as { erro?: unknown };
          if (typeof corpo.erro === "string") mensagem = corpo.erro;
        } catch {
          /* mantém a mensagem padrão */
        }
        setErro(mensagem);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setErro("Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(e) => void enviar(e)}>
      <AvisoSessaoExpirada />

      <div>
        <label className="rotulo" htmlFor="login-email">
          E-mail
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          className="campo"
          placeholder="admin@humamentepsi.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={enviando}
        />
      </div>

      <div>
        <label className="rotulo" htmlFor="login-senha">
          Senha
        </label>
        <input
          id="login-senha"
          type="password"
          autoComplete="current-password"
          required
          className="campo"
          placeholder="••••••••"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          disabled={enviando}
        />
      </div>

      {erro && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {erro}
        </p>
      )}

      <button type="submit" className="btn-primario w-full" disabled={enviando}>
        {enviando ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}

/* --------------------------------------------------------------- página */

function CarregandoLogin() {
  return (
    <p role="status" className="py-8 text-center text-sm text-slate-500">
      Carregando...
    </p>
  );
}

export default function PaginaLogin() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-petroleo-50 px-4 py-10">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <p className="text-3xl font-bold tracking-tight text-petroleo-800">HumanaMentePsi</p>
          <p className="mt-1 text-sm text-petroleo-600">Painel administrativo</p>
        </header>

        <div className="card p-6 sm:p-8">
          <h1 className="mb-5 text-xl font-semibold text-slate-900">Entrar</h1>
          <Suspense fallback={<CarregandoLogin />}>
            <FormularioLogin />
          </Suspense>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Primeiro acesso: admin@humamentepsi.com — troque a senha após o primeiro acesso.
        </p>
      </div>
    </main>
  );
}
