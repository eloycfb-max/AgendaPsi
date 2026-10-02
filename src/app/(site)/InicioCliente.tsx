"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TIPOS_RESERVA, type TipoReserva } from "@/lib/constants";
import { formatarMoeda } from "@/lib/dates";

/** Contrato de GET /api/public/rooms (docs/API.md). */
interface FotoConsultorio {
  id: number;
  url: string;
  alt: string;
  ordem: number;
}

interface ConsultorioPublico {
  id: number;
  nome: string;
  slug: string;
  descricao: string;
  recursos: string[];
  fotos: FotoConsultorio[];
  precos: Partial<Record<TipoReserva, number>>;
}

type EstadoConsultorios = "carregando" | "pronto" | "erro" | "vazio";

const TIPOS_PRECO: TipoReserva[] = ["fixo", "avulsa", "reposicao"];

/** Identidade visual de cada tipo de reserva (mesma paleta dos slots da agenda). */
const CHIP_TIPO: Record<TipoReserva, string> = {
  fixo: "border-petroleo-200 bg-petroleo-50 text-petroleo-800",
  avulsa: "border-salvia-300 bg-salvia-100 text-salvia-800",
  reposicao: "border-laranja-300 bg-laranja-100 text-slate-900",
};

/**
 * Seção "Consultórios" da página inicial (RF-001/RF-002).
 * Componente cliente: busca os consultórios públicos e exibe os estados
 * explícitos de carregando, erro de conexão e vazio.
 */
export function InicioCliente() {
  const [estado, setEstado] = useState<EstadoConsultorios>("carregando");
  const [consultorios, setConsultorios] = useState<ConsultorioPublico[]>([]);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setEstado("carregando");
    try {
      const resposta = await fetch("/api/public/rooms", { cache: "no-store" });
      if (!resposta.ok) throw new Error("Resposta inválida da API.");
      const dados = (await resposta.json()) as { consultorios?: ConsultorioPublico[] };
      const lista = Array.isArray(dados.consultorios) ? dados.consultorios : [];
      setConsultorios(lista);
      setEstado(lista.length > 0 ? "pronto" : "vazio");
    } catch {
      setConsultorios([]);
      setEstado("erro");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Falha transitória não fica presa na tela: em erro, refaz a carga a cada 8 s
  // até conseguir (o estado "erro" não muda, então o intervalo segue ativo).
  useEffect(() => {
    if (estado !== "erro") return;
    const intervalo = window.setInterval(() => void carregar(true), 8000);
    return () => window.clearInterval(intervalo);
  }, [estado, carregar]);

  return (
    <section id="consultorios" aria-labelledby="titulo-consultorios" className="bg-white py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-salvia-600">Nosso espaço</p>
            <h2 id="titulo-consultorios" className="mt-1 text-2xl font-bold text-petroleo-800 sm:text-3xl">
              Consultórios
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Conheça os três consultórios disponíveis para sublocação, com descrição, recursos e
              valores por tipo de reserva.
            </p>
          </div>
          <Link
            href="/consultorios"
            className="self-start text-sm font-semibold text-petroleo-700 underline-offset-4 hover:underline sm:self-auto"
          >
            Ver detalhes de cada consultório →
          </Link>
        </div>

        {estado === "carregando" && (
          <div role="status" aria-label="Carregando consultórios">
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((n) => (
                <li key={n} className="card animate-pulse p-5" aria-hidden="true">
                  <div className="h-5 w-2/3 rounded bg-slate-200" />
                  <div className="mt-3 h-4 w-full rounded bg-slate-100" />
                  <div className="mt-2 h-4 w-5/6 rounded bg-slate-100" />
                  <div className="mt-5 h-4 w-full rounded bg-slate-100" />
                  <div className="mt-2 h-4 w-full rounded bg-slate-100" />
                  <div className="mt-2 h-4 w-3/4 rounded bg-slate-100" />
                  <div className="mt-6 h-9 w-full rounded bg-slate-100" />
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-500">Carregando consultórios…</p>
          </div>
        )}

        {estado === "erro" && (
          <div
            role="alert"
            className="mt-8 rounded-xl border border-laranja-300 bg-laranja-100 p-6 sm:flex sm:items-center sm:justify-between sm:gap-6"
          >
            <div>
              <p className="font-semibold text-slate-900">Não foi possível carregar os consultórios.</p>
              <p className="mt-1 text-sm text-slate-700">
                Confira sua conexão com a internet — a página tenta carregar de novo sozinha em
                alguns segundos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void carregar()}
              className="btn-secundario mt-4 shrink-0 sm:mt-0"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {estado === "vazio" && (
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="font-semibold text-slate-800">Nenhum consultório disponível no momento.</p>
            <p className="mt-1 text-sm text-slate-600">
              Novos espaços serão publicados em breve. Fale com a gente pelo WhatsApp para saber mais.
            </p>
          </div>
        )}

        {estado === "pronto" && (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {consultorios.map((c) => (
              <li key={c.id} className="card flex flex-col p-5">
                <h3 className="text-lg font-bold text-petroleo-800">{c.nome}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.descricao}</p>

                {c.recursos.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {c.recursos.map((recurso) => (
                      <li
                        key={recurso}
                        className="rounded-full border border-salvia-300 bg-salvia-100 px-2.5 py-1 text-xs font-medium text-salvia-800"
                      >
                        {recurso}
                      </li>
                    ))}
                  </ul>
                )}

                <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  {TIPOS_PRECO.map((tipo) => (
                    <div key={tipo} className="flex items-center justify-between gap-3">
                      <dt
                        className={`rounded-md border px-2 py-1 text-xs font-semibold ${CHIP_TIPO[tipo]}`}
                      >
                        {TIPOS_RESERVA[tipo].rotulo}
                      </dt>
                      <dd className="text-sm font-bold text-slate-900">
                        {c.precos[tipo] === 0
                          ? "Grátis"
                          : c.precos[tipo] !== undefined
                            ? formatarMoeda(c.precos[tipo])
                            : "Consulte o valor"}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-auto pt-5">
                  <Link
                    href="/consultorios"
                    className="btn-secundario w-full"
                    aria-label={`Ver detalhes do consultório ${c.nome}`}
                  >
                    Ver consultório
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
