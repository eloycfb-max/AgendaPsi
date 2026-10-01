// Smoke test — valida critérios de aceitação do PRD via API.
// Uso: iniciar o servidor (npm run dev) e rodar `node scripts/smoke-test.mjs`
import { DatabaseSync } from "node:sqlite";

const BASE = process.env.BASE_URL || "http://localhost:3000";
let cookies = "";
let passados = 0;
let falhas = 0;

/** Remove dados de execuções anteriores para permitir reexecução (idempotência). */
function limparDadosDeTeste() {
  try {
    const db = new DatabaseSync("data/agenda.db");
    db.exec("PRAGMA busy_timeout = 5000;");
    db.exec(`
      DELETE FROM pagamentos WHERE lancamento_id IN (
        SELECT id FROM lancamentos WHERE profissional_id IN
        (SELECT id FROM profissionais WHERE nome_completo LIKE '%Smoke Teste%'));
      DELETE FROM lancamentos WHERE profissional_id IN
        (SELECT id FROM profissionais WHERE nome_completo LIKE '%Smoke Teste%');
      DELETE FROM excecoes WHERE recorrencia_id IN (
        SELECT id FROM recorrencias WHERE profissional_id IN
        (SELECT id FROM profissionais WHERE nome_completo LIKE '%Smoke Teste%'));
      DELETE FROM recorrencias WHERE profissional_id IN
        (SELECT id FROM profissionais WHERE nome_completo LIKE '%Smoke Teste%');
      DELETE FROM reservas WHERE profissional_id IN
        (SELECT id FROM profissionais WHERE nome_completo LIKE '%Smoke Teste%');
      DELETE FROM solicitacoes WHERE nome = 'Maria da Silva';
      DELETE FROM profissionais WHERE nome_completo LIKE '%Smoke Teste%';
      DELETE FROM auditoria WHERE resumo LIKE '%Smoke%' OR resumo LIKE '%smoke%' OR resumo LIKE '%Maria da Silva%';
    `);
    db.close();
    console.log("(dados de teste anteriores removidos)\n");
  } catch (e) {
    console.warn("(aviso) não foi possível limpar dados anteriores:", e.message);
  }
}
limparDadosDeTeste();

async function req(metodo, caminho, corpo, formData) {
  const headers = {};
  if (cookies) headers.Cookie = cookies;
  let body;
  if (formData) {
    body = formData;
  } else if (corpo !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(corpo);
  }
  const r = await fetch(BASE + caminho, { method: metodo, headers, body, redirect: "manual" });
  const setCookie = r.headers.get("set-cookie");
  if (setCookie) cookies = setCookie.split(";")[0];
  let json = null;
  const txt = await r.text();
  try {
    json = JSON.parse(txt);
  } catch {}
  return { status: r.status, json, txt };
}

function check(nome, cond, detalhe = "") {
  if (cond) {
    passados++;
    console.log(`  ✔ ${nome}`);
  } else {
    falhas++;
    console.log(`  ✘ ${nome} ${detalhe}`);
  }
}

const hoje = new Date().toISOString().slice(0, 10);
function proximo(weekday) {
  // data futura com o weekday desejado (0=dom..6=sat)
  const d = new Date();
  d.setDate(d.getDate() + 7);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
const seg = proximo(1);

console.log("\n== CA-007/RF-016: privacidade pública ==");
{
  const r = await req("GET", `/api/public/availability?inicio=${hoje}&dias=7`);
  const texto = JSON.stringify(r.json);
  check("availability 200", r.status === 200);
  check("sem nomes de profissionais", !/nome_profissional|profissional_id|telefon/i.test(texto));
  check("sem valores", !/valor_acordado|valor_cobrado|\d{3},\d{2}/.test(texto));
  const s = await req("GET", "/api/public/rooms");
  check("rooms 200", s.status === 200);
}

console.log("\n== CA-011: autorização ==");
{
  const r = await req("GET", "/api/admin/dashboard");
  check("admin sem login → 401", r.status === 401, `(${r.status})`);
  const p = await req("POST", "/api/admin/profissionais", { nome: "Hacker Teste" });
  check("escrita sem login → 401", p.status === 401, `(${p.status})`);
}

console.log("\n== Login ==");
{
  const r = await req("POST", "/api/auth/login", { email: "admin@humamentepsi.com", senha: "humana@2026" });
  check("login OK", r.status === 200, JSON.stringify(r.json));
  const me = await req("GET", "/api/auth/me");
  check("sessão autenticada", me.json?.autenticado === true);
}

console.log("\n== Profissionais (RF-028/031) ==");
let profId;
{
  const r = await req("POST", "/api/admin/profissionais", {
    nome: "Dra. Smoke Teste",
    profissao: "Psicóloga",
    telefone: "21999990000",
  });
  check("criar profissional", r.status === 201, JSON.stringify(r.json));
  profId = r.json?.id;
}

console.log("\n== CA-002: domingo bloqueado ==");
{
  const domingo = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7 - d.getDay()); // próximo domingo
    return d.toISOString().slice(0, 10);
  })();
  const r = await req("POST", "/api/admin/reservas", {
    consultorio_id: 1,
    profissional_id: profId,
    tipo: "avulsa",
    data: domingo,
    inicio: 9,
  });
  check("reserva em domingo → 400", r.status === 400, `(${r.status})`);
}

console.log("\n== CA-001: grade de horários ==");
{
  const r = await req("POST", "/api/admin/reservas", {
    consultorio_id: 1,
    profissional_id: profId,
    tipo: "avulsa",
    data: seg,
    inicio: 6,
  });
  check("06h → 400", r.status === 400, `(${r.status})`);
}

console.log("\n== CA-006: conflito / unicidade ==");
{
  const r1 = await req("POST", "/api/admin/reservas", {
    consultorio_id: 1,
    profissional_id: profId,
    tipo: "avulsa",
    data: seg,
    inicio: 10,
    valor: "100,00",
  });
  check("1ª reserva aceita", r1.status === 201, JSON.stringify(r1.json));
  const r2 = await req("POST", "/api/admin/reservas", {
    consultorio_id: 1,
    profissional_id: profId,
    tipo: "reposicao",
    data: seg,
    inicio: 10,
  });
  check("2ª reserva conflitante → 409", r2.status === 409, `(${r2.status})`);
  // mesma hora em outro consultório é permitido
  const r3 = await req("POST", "/api/admin/reservas", {
    consultorio_id: 2,
    profissional_id: profId,
    tipo: "avulsa",
    data: seg,
    inicio: 10,
  });
  check("outra sala mesmo horário → 201", r3.status === 201, `(${r3.status})`);
}

console.log("\n== CA-003/CA-004: recorrência vs avulsa ==");
let recId;
{
  const r = await req("POST", "/api/admin/recorrencias", {
    consultorio_id: 3,
    profissional_id: profId,
    dia_semana: 2, // terça
    inicio: 9,
    data_inicio: proximo(2),
  });
  check("criar recorrência ter 09h", r.status === 201, JSON.stringify(r.json));
  recId = r.json?.id;

  const seg2 = (() => {
    const d = new Date(seg);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();
  const r2 = await req("POST", "/api/admin/recorrencias", {
    consultorio_id: 3,
    profissional_id: profId,
    dia_semana: 2,
    inicio: 9,
    data_inicio: proximo(2),
  });
  check("recorrência duplicada → 409", r2.status === 409, `(${r2.status})`);
  void seg2;

  const avulsa = await req("POST", "/api/admin/reservas", {
    consultorio_id: 1,
    profissional_id: profId,
    tipo: "avulsa",
    data: seg,
    inicio: 14,
  });
  check("avulsa criada", avulsa.status === 201);
  const seg3 = new Date(seg);
  seg3.setDate(seg3.getDate() + 7);
  const seg3Iso = seg3.toISOString().slice(0, 10);
  const repete = await req("POST", "/api/admin/reservas", {
    consultorio_id: 1,
    profissional_id: profId,
    tipo: "avulsa",
    data: seg3Iso,
    inicio: 14,
  });
  check("avulso não repete em outra semana → 201", repete.status === 201, `(${repete.status})`);
}

console.log("\n== CA-013: liberar ocorrência da série ==");
{
  const ter = proximo(2);
  const r = await req("POST", `/api/admin/recorrencias/${recId}/excecoes`, { data: ter, motivo: "teste" });
  check("exceção criada", r.status === 201, JSON.stringify(r.json));
  const av = await req("GET", `/api/public/availability?inicio=${ter}&dias=7`);
  const sala3 = av.json?.consultorios?.find((c) => c.id === 3);
  const dia = sala3?.dias?.find((d) => d.data === ter);
  const slot = dia?.horarios?.find((h) => h.hora === 9);
  check("ocorrência liberada fica livre", slot?.status === "livre", JSON.stringify(slot));
  const demais = (() => {
    const d = new Date(ter);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();
  const av2 = await req("GET", `/api/public/availability?inicio=${demais}&dias=7`);
  const s2 = av2.json?.consultorios?.find((c) => c.id === 3);
  const d2 = s2?.dias?.find((d) => d.data === demais);
  check("demais ocorrências seguem ocupadas", d2?.horarios?.find((h) => h.hora === 9)?.status === "ocupado");
}

console.log("\n== CA-009/CA-010: financeiro ==");
{
  const l = await req("GET", "/api/admin/lancamentos");
  check("listar lançamentos", l.status === 200);
  const alvo = l.json?.lancamentos?.find((x) => x.valor_cobrado === 10000 && x.saldo === 10000);
  check("lançamento de R$ 100,00 criado com a reserva (CA-010 valor acordado)", !!alvo, JSON.stringify(l.json?.lancamentos?.slice(0, 3)));
  if (alvo) {
    const p = await req("POST", `/api/admin/lancamentos/${alvo.id}/pagamentos`, {
      valor: "50,00",
      forma: "Pix",
    });
    check("pagamento parcial aceito", p.status === 200, JSON.stringify(p.json));
    check("saldo = R$ 50,00", p.json?.lancamento?.saldo === 5000, `saldo=${p.json?.lancamento?.saldo}`);
    check("situação parcial", p.json?.lancamento?.situacao_efetiva === "parcial", p.json?.lancamento?.situacao_efetiva);
    const acima = await req("POST", `/api/admin/lancamentos/${alvo.id}/pagamentos`, {
      valor: "60,00",
      forma: "Pix",
    });
    check("pagamento acima do saldo → 400", acima.status === 400, `(${acima.status})`);
  }
}

console.log("\n== CA-008: solicitação + WhatsApp ==");
{
  const r = await req("POST", "/api/public/solicitacoes", {
    nome: "Maria da Silva",
    telefone: "21988887777",
    consultorio_id: 2,
    data: seg,
    inicio: 15,
    tipo: "avulsa",
  });
  check("solicitação pendente criada", r.status === 201, JSON.stringify(r.json));
  const lista = await req("GET", "/api/admin/solicitacoes?situacao=pendente");
  const sol = lista.json?.solicitacoes?.find((s) => s.nome === "Maria da Silva");
  check("solicitação aparece pendente", !!sol);
  if (sol) {
    const conf = await req("POST", `/api/admin/solicitacoes/${sol.id}/confirmar`, { profissional_id: profId });
    check("confirmação revalida e cria reserva", conf.status === 200, JSON.stringify(conf.json));
    const ocupado = await req("POST", "/api/admin/reservas", {
      consultorio_id: 2,
      profissional_id: profId,
      tipo: "avulsa",
      data: seg,
      inicio: 15,
    });
    check("horário confirmado agora está ocupado → 409", ocupado.status === 409, `(${ocupado.status})`);
  }
}

console.log("\n== CA-014: exportação CSV com filtros ==");
{
  const r = await fetch(`${BASE}/api/admin/relatorios/exportar?conjunto=lancamentos&de=2000-01-01&ate=2000-01-02`, {
    headers: { Cookie: cookies },
  });
  const txt = await r.text();
  check("CSV 200", r.status === 200);
  const linhas = txt.trim().split(/\r?\n/);
  check("período vazio → só cabeçalho", linhas.length <= 2, `linhas=${linhas.length}`);
  const r2 = await fetch(`${BASE}/api/admin/relatorios/exportar?conjunto=lancamentos&de=2000-01-01&ate=2030-12-31`, {
    headers: { Cookie: cookies },
  });
  const txt2 = await r2.text();
  check(
    "período amplo contém registros",
    r2.status === 200 && /Smoke Teste/.test(txt2),
    `status=${r2.status} linhas=${txt2.trim().split(/\r?\n/).length}`
  );
}

console.log("\n== CA-006 (real): duas confirmações SIMULTÂNEAS ==");
{
  const disparo = () =>
    req("POST", "/api/admin/reservas", {
      consultorio_id: 1,
      profissional_id: profId,
      tipo: "avulsa",
      data: seg,
      inicio: 16,
    });
  const [a, b] = await Promise.all([disparo(), disparo()]);
  const aceitas = [a, b].filter((r) => r.status === 201).length;
  const conflitos = [a, b].filter((r) => r.status === 409).length;
  check("exatamente 1 aceita, 1 → 409", aceitas === 1 && conflitos === 1, `201=${aceitas} 409=${conflitos}`);
  const ocupado = await req("GET", `/api/public/availability?inicio=${seg}&dias=1`);
  const sala1 = ocupado.json?.consultorios?.find((c) => c.id === 1);
  const slot = sala1?.dias?.[0]?.horarios?.find((h) => h.hora === 16);
  check("horário refletido como ocupado na agenda pública", slot?.status === "ocupado", JSON.stringify(slot));
}

console.log("\n== Auditoria ==");
{
  const r = await req("GET", "/api/admin/auditoria?limite=20");
  check("auditoria registra operações", r.status === 200 && r.json?.eventos?.length > 0);
}

// Limpa os dados criados por esta execução para deixar o banco pronto para uso real.
limparDadosDeTeste();

console.log(`\nResultado: ${passados} passaram, ${falhas} falharam.\n`);
process.exit(falhas > 0 ? 1 : 0);
