// Atualiza os recursos dos consultórios e REMOVE os preços publicados
// (decisão: o site não informa valores — exibe "Consulte o valor").
// Uso: servidor ligado e `node scripts/atualizar-consultorios.mjs`. Idempotente.
const BASE = process.env.BASE_URL || "http://localhost:3000";

const RECURSOS = {
  1: "2 poltronas;Estante;Mesa com 2 cadeiras;Ar-condicionado;Wi-Fi",
  2: "2 poltronas;Mesa de apoio;Ar-condicionado;Wi-Fi",
  3: "Poltrona;Divã;Estante;Mesa;2 cadeiras;Wi-Fi",
};

async function api(metodo, caminho, body, cookie) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(BASE + caminho, {
    method: metodo,
    headers,
    body: body !== undefined && metodo !== "GET" ? JSON.stringify(body) : undefined,
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

// 1) Recursos
for (const [id, recursos] of Object.entries(RECURSOS)) {
  const r = await api("PUT", `/api/admin/consultorios/${id}`, { recursos }, cookie);
  console.log(`Consultório ${id}: recursos -> ${r.status} ${r.status === 200 ? "atualizados" : r.txt}`);
}

// 2) Remove todos os preços publicados
const lista = await api("GET", "/api/admin/consultorios", null, cookie);
let removidos = 0;
for (const sala of lista.json?.consultorios || []) {
  for (const p of sala.precos || []) {
    if (p.situacao === "inativo") continue;
    const r = await api("DELETE", `/api/admin/precos/${p.id}`, undefined, cookie);
    if (r.status === 200) removidos++;
    else console.log(`  !! preço ${p.id} (${sala.nome} ${p.tipo}) -> ${r.status} ${r.txt}`);
  }
}
console.log(`\nPreços removidos: ${removidos}`);

// 3) Confere o que o público vê
const pub = await api("GET", "/api/public/rooms");
console.log("\nResumo público (/api/public/rooms):");
for (const c of pub.json?.consultorios || []) {
  console.log(`  ${c.nome}: recursos = ${JSON.stringify(c.recursos)} | precos = ${JSON.stringify(c.precos)}`);
}
