"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { RequisicaoErro, fetchAdmin, jsonInit, mensagemDe } from "./fetchAdmin";

/* ---------------------------------------------------------------- tipos */

interface SessaoAdmin {
  adminId: number;
  nome: string;
  email: string;
}

interface RespostaMe {
  autenticado: boolean;
  sessao: SessaoAdmin | null;
}

interface LinkAdmin {
  href: string;
  rotulo: string;
}

const LINKS: LinkAdmin[] = [
  { href: "/admin", rotulo: "Visão geral" },
  { href: "/admin/agenda", rotulo: "Agenda" },
  { href: "/admin/profissionais", rotulo: "Profissionais" },
  { href: "/admin/consultorios", rotulo: "Consultórios" },
  { href: "/admin/solicitacoes", rotulo: "Solicitações" },
  { href: "/admin/financeiro", rotulo: "Financeiro" },
  { href: "/admin/relatorios", rotulo: "Relatórios" },
  { href: "/admin/auditoria", rotulo: "Auditoria" },
];

function linkAtivo(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* --------------------------------------------------------------- itens */

function ItemLink({ link, ativo, aoNavegar }: { link: LinkAdmin; ativo: boolean; aoNavegar?: () => void }) {
  return (
    <li>
      <Link
        href={link.href}
        aria-current={ativo ? "page" : undefined}
        onClick={aoNavegar}
        className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          ativo ? "bg-petroleo-600 text-white" : "text-petroleo-100 hover:bg-petroleo-700 hover:text-white"
        }`}
      >
        {link.rotulo}
      </Link>
    </li>
  );
}

/* -------------------------------------------------------------- layout */

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [verificando, setVerificando] = useState(true);
  const [autenticado, setAutenticado] = useState(false);
  const [sessao, setSessao] = useState<SessaoAdmin | null>(null);
  const [erroRede, setErroRede] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [erroSaida, setErroSaida] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);

  const verificarSessao = useCallback(async () => {
    setVerificando(true);
    setErroRede(null);
    try {
      const dados = await fetchAdmin<RespostaMe>("/api/auth/me");
      if (!dados.autenticado || !dados.sessao) {
        setAutenticado(false);
        router.replace("/login");
        return;
      }
      setSessao(dados.sessao);
      setAutenticado(true);
    } catch (e) {
      if (e instanceof RequisicaoErro && e.status === 401) {
        router.replace("/login");
        return;
      }
      setErroRede(mensagemDe(e));
    } finally {
      setVerificando(false);
    }
  }, [router]);

  useEffect(() => {
    void verificarSessao();
  }, [verificarSessao]);

  // Fecha o menu mobile ao trocar de página
  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  async function sair(): Promise<void> {
    if (saindo) return;
    setSaindo(true);
    setErroSaida(null);
    try {
      await fetchAdmin("/api/auth/logout", jsonInit("POST"));
      router.replace("/login");
    } catch (e) {
      if (e instanceof RequisicaoErro && e.status === 401) {
        router.replace("/login");
        return;
      }
      setErroSaida(mensagemDe(e));
      setSaindo(false);
    }
  }

  if (verificando) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-petroleo-900 px-4">
        <p className="text-lg font-semibold text-white">HumanaMentePsi</p>
        <p role="status" className="text-sm text-petroleo-200">
          Verificando sessão...
        </p>
      </div>
    );
  }

  if (erroRede) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-petroleo-900 px-4 text-center">
        <p role="alert" className="max-w-md text-sm text-white">
          {erroRede}
        </p>
        <button type="button" className="btn-secundario" onClick={() => void verificarSessao()}>
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!autenticado) {
    // Redirecionando para /login
    return (
      <div className="flex min-h-screen items-center justify-center bg-petroleo-900">
        <p role="status" className="text-sm text-petroleo-200">
          Redirecionando para a página de entrada...
        </p>
      </div>
    );
  }

  const nomeAdmin = sessao?.nome ?? "Administrador";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Barra superior (mobile) */}
      <header className="sticky top-0 z-40 bg-petroleo-800 text-white lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="text-base font-bold tracking-tight">
            HumanaMentePsi
            <span className="ml-2 text-xs font-medium text-petroleo-200">Painel</span>
          </Link>
          <button
            type="button"
            className="rounded-lg border border-petroleo-600 px-3 py-1.5 text-sm font-semibold hover:bg-petroleo-700"
            aria-expanded={menuAberto}
            aria-controls="menu-admin-mobile"
            aria-label={menuAberto ? "Fechar menu de navegação" : "Abrir menu de navegação"}
            onClick={() => setMenuAberto((a) => !a)}
          >
            {menuAberto ? "Fechar" : "Menu"}
          </button>
        </div>
        {menuAberto && (
          <nav id="menu-admin-mobile" aria-label="Navegação do painel" className="border-t border-petroleo-700 px-3 pb-4 pt-2">
            <ul className="space-y-1">
              {LINKS.map((link) => (
                <ItemLink
                  key={link.href}
                  link={link}
                  ativo={linkAtivo(pathname, link.href)}
                  aoNavegar={() => setMenuAberto(false)}
                />
              ))}
            </ul>
            <div className="mt-3 border-t border-petroleo-700 pt-3">
              <p className="truncate px-3 text-xs text-petroleo-200">{nomeAdmin}</p>
              <button
                type="button"
                className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-white hover:bg-petroleo-700"
                disabled={saindo}
                onClick={() => void sair()}
              >
                {saindo ? "Saindo..." : "Sair"}
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* Barra lateral (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-petroleo-800 text-white lg:flex">
        <div className="border-b border-petroleo-700 px-5 py-5">
          <Link href="/admin" className="block text-lg font-bold tracking-tight">
            HumanaMentePsi
          </Link>
          <p className="mt-0.5 text-xs text-petroleo-200">Painel administrativo</p>
        </div>

        <nav aria-label="Navegação do painel" className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {LINKS.map((link) => (
              <ItemLink key={link.href} link={link} ativo={linkAtivo(pathname, link.href)} />
            ))}
          </ul>
        </nav>

        <div className="border-t border-petroleo-700 px-5 py-4">
          <p className="truncate text-sm font-semibold" title={sessao?.email}>
            {nomeAdmin}
          </p>
          {sessao && <p className="truncate text-xs text-petroleo-200">{sessao.email}</p>}
          {erroSaida && (
            <p role="alert" className="mt-2 text-xs text-amarelo-300">
              {erroSaida}
            </p>
          )}
          <button
            type="button"
            className="btn mt-3 w-full border border-petroleo-600 bg-petroleo-700 text-white hover:bg-petroleo-600"
            disabled={saindo}
            onClick={() => void sair()}
          >
            {saindo ? "Saindo..." : "Sair"}
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {erroSaida && (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {erroSaida}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
