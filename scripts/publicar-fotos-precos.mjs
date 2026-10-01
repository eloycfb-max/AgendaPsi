// Publica as fotos dos consultórios e a tabela de preços no painel.
// Uso: servidor ligado (npm run dev) e `node scripts/publicar-fotos-precos.mjs`.
// Idempotente: pula foto/preço já existente com o mesmo valor.
import { readFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const FOTOS = "C:\\Users\\eloyp\\Downloads\\CONSULTÓRIO BARRA";

const PLANOS = [
  { id: 1, arquivo: "CONSULTÓRIO 01.jpg", alt: "Consultório 01 — HumanaMentePsi", precos: { fixo: "41,00", avulsa: "44,00", reposicao: "0,00" } },
  { id: 2, arquivo: "CONSULTÓRIO 02.jpg", alt: "Consultório 02 — HumanaMentePsi", precos: { fixo: "35,00", avulsa: "38,00", reposicao: "0,00" } },
  { id: 3, arquivo: "CONSULTÓRIO 03.jpg", alt: "Consultório 03 — HumanaMentePsi", precos: { fixo: "38,00", avulsa: "41,00", reposicao: "0,00" } },
];

const cents = (v) => Math.round(Number(v.replace(".", "").replace(",", ".")) * 100);

async function api(metodo, caminho, body, cookie, isForm = false) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body && !isForm) headers["Content-Type"] = "application/json";
  const r = await fetch(BASE + caminho, {
    method: metodo,
    headers,
    body: isForm ? body : body && metodo !== "GET" ? JSON.stringify(body) : undefined,
  });
  const setCookie = r.headers.get("set-cookie");
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch {}
  return { status: r.status, json, txt: texto, cookie: setCookie ? setCookie.split(";")[0] : cookie };
}

const login = await api("POST", "/api/auth/login", {
  email: "admin@humamentepsi.com",
  senha: process.env.ADMIN_SENHA || "humana@2026",
});
if (login.status !== 200) {
  console.error("Falha no login:", login.status, login.txt);
  process.exit(1);
}
const cookie = login.cookie;
console.log("Login OK\n");

const atual = await api("GET", "/api/admin/consultorios", null, cookie);
const existentes = new Map((atual.json?.consultorios || []).map((c) => [c.id, c]));
let enviados = 0;
let precosCriados = 0;

for (const plano of PLANOS) {
  const sala = existentes.get(plano.id);
  if (!sala) {
    console.log(`!! Consultório ${plano.id} não encontrado — pulando.`);
    continue;
  }

  // --- Foto ---
  const jaTemFoto = (sala.fotos || []).some((f) => f.situacao !== "inativo");
  if (jaTemFoto) {
    console.log(`Consultório ${plano.id}: já tem foto — pulando upload.`);
  } else {
    const bytes = await readFile(path.join(FOTOS, plano.arquivo));
    const form = new FormData();
    form.append("arquivo", new Blob([bytes], { type: "image/jpeg" }), plano.arquivo);
    form.append("alt", plano.alt);
    const up = await api("POST", `/api/admin/consultorios/${plano.id}/fotos`, form, cookie, true);
    console.log(`Consultório ${plano.id}: foto -> ${up.status} ${up.status === 201 ? "enviada" : up.txt}`);
    if (up.status === 201) enviados++;
  }

  // --- Preços ---
  for (const [tipo, valor] of Object.entries(plano.precos)) {
    const alvo = cents(valor);
    const jaIgual = (sala.precos || []).some(
      (p) => p.tipo === tipo && p.situacao !== "inativo" && Number(p.valor_cents) === alvo
    );
    if (jaIgual) {
      console.log(`  ${tipo}: já ${valor} — pulando.`);
      continue;
    }
    const r = await api("POST", `/api/admin/consultorios/${plano.id}/precos`, { tipo, valor }, cookie);
    console.log(`  ${tipo} R$ ${valor} -> ${r.status}${r.status === 201 ? " criado" : " " + r.txt}`);
    if (r.status === 201) precosCriados++;
  }
}

console.log(`\nFotos enviadas: ${enviados} · Preços criados: ${precosCriados}`);

const pub = await api("GET", "/api/public/rooms");
console.log("\nResumo público (/api/public/rooms):");
for (const c of pub.json?.consultorios || []) {
  console.log(
    `  ${c.nome}: ${c.fotos.length} foto(s), preços =`,
    JSON.stringify(c.precos)
  );
}
