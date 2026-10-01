// Verifica status HTTP das rotas principais (com timeout por requisição).
const paginas = [
  "/",
  "/consultorios",
  "/diferenciais",
  "/contato",
  "/politica-de-privacidade",
  "/login",
  "/admin",
  "/admin/agenda",
  "/admin/profissionais",
  "/admin/consultorios",
  "/admin/solicitacoes",
  "/admin/financeiro",
  "/admin/relatorios",
  "/admin/auditoria",
  "/api/public/rooms",
  "/api/public/availability?dias=7",
];

const BASE = process.env.BASE_URL || "http://localhost:3000";
let falhas = 0;

for (const p of paginas) {
  try {
    const r = await fetch(BASE + p, { redirect: "manual", signal: AbortSignal.timeout(90000) });
    const ok = r.status >= 200 && r.status < 400;
    if (!ok) falhas++;
    console.log(`${ok ? "OK " : "FALHA"} ${r.status} ${p}`);
  } catch (e) {
    falhas++;
    console.log(`FALHA ERRO ${p} -> ${e.message}`);
  }
}
console.log(`\n${falhas === 0 ? "TODAS AS ROTAS OK" : falhas + " rotas com problema"}`);
process.exit(falhas ? 1 : 0);
