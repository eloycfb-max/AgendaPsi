/**
 * Utilitários de data no fuso America/Sao_Paulo (PRD premissa 7).
 * Datas são armazenadas como "YYYY-MM-DD" (data local de São Paulo).
 */

const TZ = "America/Sao_Paulo";

/** Data local de hoje em São Paulo no formato YYYY-MM-DD */
export function hojeIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Converte YYYY-MM-DD para Date UTC à meia-noite (apenas para cálculo de dias) */
export function isoParaDate(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

export function dateParaIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDias(iso: string, dias: number): string {
  const d = isoParaDate(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return dateParaIso(d);
}

export function addMeses(iso: string, meses: number): string {
  const d = isoParaDate(iso);
  d.setUTCMonth(d.getUTCMonth() + meses);
  return dateParaIso(d);
}

/** Diferença em dias entre duas datas (positiva se b > a) */
export function difDias(a: string, b: string): number {
  return Math.round((isoParaDate(b).getTime() - isoParaDate(a).getTime()) / 86400000);
}

/** Segunda-feira da semana que contém a data */
export function inicioSemana(iso: string): string {
  const d = isoParaDate(iso);
  const dow = d.getUTCDay(); // 0=domingo
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return dateParaIso(d);
}

/** 1=segunda ... 6=sábado; domingo=0 */
export function diaSemana(iso: string): number {
  return isoParaDate(iso).getUTCDay();
}

const formatoData = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC", // a data é um calendário puro (Date.UTC à meia-noite): formatar em SP regraria um dia para trás
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const formatoDataLonga = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const formatoCurto = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

/** Ex.: 05/10/2026 */
export function formatarData(iso: string): string {
  return formatoData.format(isoParaDate(iso));
}

/** Ex.: segunda-feira, 5 de outubro de 2026 */
export function formatarDataLonga(iso: string): string {
  const s = formatoDataLonga.format(isoParaDate(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Ex.: seg., 05/10 */
export function formatarDataCurta(iso: string): string {
  const s = formatoCurto.format(isoParaDate(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Ex.: 07:00 – 08:00 */
export function formatarHora(inicio: number, fim?: number): string {
  const f = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return fim !== undefined ? `${f(inicio)} – ${f(fim)}` : f(inicio);
}

/** Ex.: 05/10/2026 09:00 (para auditoria, fuso SP) */
export function formatarDataHora(isoHora: string): string {
  // isoHora vem de datetime('now') do SQLite em UTC — converte para SP
  const d = new Date(isoHora.includes("T") ? isoHora : isoHora.replace(" ", "T") + "Z");
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Ex.: R$ 1.234,56 */
export function formatarMoeda(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/** Converte "123,45" ou "123.45" para centavos */
export function paraCentavos(valor: string | number): number {
  if (typeof valor === "number") return Math.round(valor * 100);
  const limpo = valor.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  if (Number.isNaN(n)) throw new Error("Valor inválido");
  return Math.round(n * 100);
}

/** Data atual de São Paulo para exibição em "hoje" */
export function ehHoje(iso: string): boolean {
  return iso === hojeIso();
}
