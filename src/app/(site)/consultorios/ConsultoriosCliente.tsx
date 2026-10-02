"use client";

import Image from "next/image";
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

/** Iniciais do nome do consultório para o placeholder da galeria. */
function iniciais(nome: string): string {
  const partes = nome.split(/\s+/).filter(Boolean);
  const sigla = partes.map((p) => p.charAt(0)).join("").slice(0, 2);
  return sigla.toUpperCase() || "HM";
}

/** Galeria de fotos do consultório; sem fotos, exibe placeholder elegante. */
function Galeria({ consultorio }: { consultorio: ConsultorioPublico }) {
  const fotos = [...consultorio.fotos].sort((a, b) => a.ordem - b.ordem || a.id - b.id);

  if (fotos.length === 0) {
    return (
      <div
        role="img"
        aria-label={`Fotos do consultório ${consultorio.nome} — em breve`}
        className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-petroleo-100 bg-petroleo-50"
      >
        <span
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-petroleo-700 text-xl font-bold text-white"
        >
          {iniciais(consultorio.nome)}
        </span>
        <span className="mt-3 text-xs font-semibold uppercase tracking-widest text-petroleo-700">
          Fotos em breve
        </span>
      </div>
    );
  }

  const [principal, ...demais] = fotos;

  return (
    <div className="space-y-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-white">
        <Image
          src={principal.url}
          alt={principal.alt}
          fill
          sizes="(max-width: 1024px) 92vw, 44vw"
          className="object-cover"
        />
      </div>
      {demais.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {demais.slice(0, 3).map((foto) => (
            <li key={foto.id} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-white">
              <Image
                src={foto.url}
                alt={foto.alt}
                fill
                sizes="(max-width: 1024px) 30vw, 14vw"
                className="object-cover"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Listagem pública dos consultórios (MOD-08 / RF-054 a RF-057).
 * Estados explícitos: carregando, erro de conexão (com "Tentar novamente") e vazio.
 */
export function ConsultoriosCliente() {
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

  if (estado === "carregando") {
    return (
      <div role="status" aria-label="Carregando consultórios" className="mx-auto max-w-6xl px-4 py-10">
        <ul className="grid gap-6 lg:grid-cols-2">
          {[0, 1].map((n) => (
            <li key={n} className="card animate-pulse p-5" aria-hidden="true">
              <div className="aspect-[4/3] w-full rounded-xl bg-slate-100" />
              <div className="mt-4 h-5 w-1/2 rounded bg-slate-200" />
              <div className="mt-3 h-4 w-full rounded bg-slate-100" />
              <div className="mt-2 h-4 w-5/6 rounded bg-slate-100" />
              <div className="mt-5 h-9 w-full rounded bg-slate-100" />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-500">Carregando consultórios…</p>
      </div>
    );
  }

  if (estado === "erro") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div
          role="alert"
          className="rounded-xl border border-laranja-300 bg-laranja-100 p-6 sm:flex sm:items-center sm:justify-between sm:gap-6"
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
      </div>
    );
  }

  if (estado === "vazio") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="font-semibold text-slate-800">Nenhum consultório disponível no momento.</p>
          <p className="mt-1 text-sm text-slate-600">
            Novos espaços serão publicados em breve. Fale conosco pelo WhatsApp para saber mais.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <ul className="grid gap-6 lg:grid-cols-2">
        {consultorios.map((c) => (
          <li key={c.id} className="card overflow-hidden">
            <div className="grid lg:grid-cols-[1.05fr_1fr]">
              <div className="bg-slate-100 p-4 sm:p-5">
                <Galeria consultorio={c} />
              </div>

              <div className="flex flex-col p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-salvia-600">
                  Consultório
                </p>
                <h2 className="mt-1 text-xl font-bold text-petroleo-800 sm:text-2xl">{c.nome}</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{c.descricao}</p>

                {c.recursos.length > 0 && (
                  <section className="mt-4" aria-label={`Recursos do consultório ${c.nome}`}>
                    <h3 className="text-sm font-bold text-slate-800">Recursos</h3>
                    <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {c.recursos.map((recurso) => (
                        <li key={recurso} className="flex items-start gap-2 text-sm text-slate-700">
                          <span aria-hidden="true" className="font-bold text-salvia-600">
                            ✓
                          </span>
                          <span>{recurso}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="mt-4" aria-label={`Valores do consultório ${c.nome}`}>
                  <h3 className="text-sm font-bold text-slate-800">Valores</h3>
                  <ul className="mt-2 space-y-2">
                    {TIPOS_PRECO.map((tipo) => (
                      <li
                        key={tipo}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <span
                          className={`rounded-md border px-2 py-1 text-xs font-semibold ${CHIP_TIPO[tipo]}`}
                        >
                          {TIPOS_RESERVA[tipo].rotulo}
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {c.precos[tipo] === 0
                            ? "Grátis"
                            : c.precos[tipo] !== undefined
                              ? formatarMoeda(c.precos[tipo])
                              : "Consulte o valor"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                <p className="mt-4 text-xs leading-relaxed text-slate-500">
                  A solicitação registra o seu interesse; o horário passa a ser seu somente após a
                  confirmação do administrador.
                </p>

                <div className="mt-auto pt-5">
                  <Link
                    href="/agenda"
                    className="btn-primario w-full"
                    aria-label={`Solicitar horário no consultório ${c.nome}`}
                  >
                    Solicitar este horário
                  </Link>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
