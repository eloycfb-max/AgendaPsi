import { getDb, transacao } from "@/lib/db";
import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { carregarLancamento } from "@/lib/finance";
import { paraCentavos } from "@/lib/dates";

/**
 * GET /api/admin/lancamentos?profissional_id&consultorio_id&de&ate&situacao
 * Lista lançamentos com saldo e situação efetiva (RF-047/RF-051).
 */
export async function GET(req: Request): Promise<Response> {
  try {
    await exigirSessao();
    const url = new URL(req.url);
    const cond: string[] = [];
    const params: unknown[] = [];
    const f = (k: string) => url.searchParams.get(k);

    if (f("profissional_id")) {
      cond.push("l.profissional_id = ?");
      params.push(Number(f("profissional_id")));
    }
    if (f("consultorio_id")) {
      cond.push("l.consultorio_id = ?");
      params.push(Number(f("consultorio_id")));
    }
    if (f("de")) {
      cond.push("l.data_referencia >= ?");
      params.push(f("de"));
    }
    if (f("ate")) {
      cond.push("l.data_referencia <= ?");
      params.push(f("ate"));
    }
    const situacaoFiltro = f("situacao");
    const where = cond.length ? " WHERE " + cond.join(" AND ") : "";

    const db = getDb();
    const ids = db
      .prepare(`SELECT l.id FROM lancamentos l${where} ORDER BY l.data_referencia DESC, l.id DESC LIMIT 500`)
      .all(...(params as never[])) as { id: number }[];

    let lancamentos = ids.map((i) => carregarLancamento(Number(i.id))!).filter(Boolean);
    if (situacaoFiltro && situacaoFiltro !== "todas") {
      lancamentos = lancamentos.filter((l) => l.situacao_efetiva === situacaoFiltro);
    }

    return ok({ lancamentos });
  } catch (e) {
    return tratarErro(e);
  }
}

/** POST /api/admin/lancamentos — lançamento manual (RF-046/RF-047) */
export async function POST(req: Request): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const b = await lerCorpo<{
      profissional_id?: number;
      consultorio_id?: number;
      reserva_id?: number;
      data_referencia?: string;
      valor?: string | number;
      vencimento?: string;
      observacoes?: string;
    }>(req);
    const profissionalId = Number(b.profissional_id);
    const consultorioId = Number(b.consultorio_id);
    const dataRef = b.data_referencia || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataRef)) return erro(400, "Data de referência inválida.");
    let valor: number;
    try {
      valor = paraCentavos(b.valor ?? "");
    } catch {
      return erro(400, "Valor inválido.");
    }
    if (valor <= 0) return erro(400, "O valor cobrado deve ser maior que zero.");

    const db = getDb();
    const prof = db.prepare("SELECT id FROM profissionais WHERE id = ?").get(profissionalId);
    const sala = db.prepare("SELECT id FROM consultorios WHERE id = ?").get(consultorioId);
    if (!prof) return erro(400, "Profissional inválido.");
    if (!sala) return erro(400, "Consultório inválido.");

    const r = transacao(() =>
      db
        .prepare(
          `INSERT INTO lancamentos (profissional_id, reserva_id, consultorio_id, data_referencia, valor_cobrado, vencimento, observacoes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          profissionalId,
          b.reserva_id || null,
          consultorioId,
          dataRef,
          valor,
          b.vencimento || dataRef,
          (b.observacoes || "").trim() || null
        )
    );
    const id = Number(r.lastInsertRowid);
    registrarAuditoria(sessao.adminId, "criar", "lancamento", id, `Lançamento de R$ ${(valor / 100).toFixed(2)} criado.`);
    return ok({ ok: true, id, lancamento: carregarLancamento(id) }, { status: 201 });
  } catch (e) {
    return tratarErro(e);
  }
}
