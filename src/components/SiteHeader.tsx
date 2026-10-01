"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/", rotulo: "Início" },
  { href: "/consultorios", rotulo: "Consultórios" },
  { href: "/agenda", rotulo: "Agenda" },
  { href: "/diferenciais", rotulo: "Diferenciais" },
  { href: "/contato", rotulo: "Contato" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => setAberto(false), [pathname]);

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/agenda`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // fallback: navega para a agenda onde o link também pode ser copiado
      window.location.href = "/agenda";
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="HumanaMentePsi — página inicial">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-petroleo-700 text-sm font-bold text-white">
            HM
          </span>
          <span className="text-lg font-bold text-petroleo-800">
            Humana<span className="text-salvia-600">Mente</span>Psi
          </span>
        </Link>

        <nav aria-label="Navegação principal" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname === l.href
                  ? "bg-petroleo-50 text-petroleo-800"
                  : "text-slate-600 hover:bg-slate-50 hover:text-petroleo-700"
              }`}
              aria-current={pathname === l.href ? "page" : undefined}
            >
              {l.rotulo}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={copiarLink}
            className="btn-secundario hidden text-xs sm:inline-flex"
            title="Copiar link público da agenda"
          >
            {copiado ? "Link copiado!" : "Copiar link"}
          </button>
          <Link
            href="https://wa.me/5521987540264"
            target="_blank"
            rel="noopener noreferrer"
            className="btn bg-green-600 text-white hover:bg-green-700"
          >
            WhatsApp
          </Link>
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="btn-secundario px-2 md:hidden"
            aria-expanded={aberto}
            aria-label="Abrir menu"
          >
            <span className="text-lg leading-none">{aberto ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {aberto && (
        <nav aria-label="Navegação móvel" className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          <ul className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${
                    pathname === l.href ? "bg-petroleo-50 text-petroleo-800" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {l.rotulo}
                </Link>
              </li>
            ))}
            <li>
              <button onClick={copiarLink} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">
                {copiado ? "Link copiado!" : "Copiar link da agenda"}
              </button>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
