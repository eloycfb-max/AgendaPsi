import { getDb } from "@/lib/db";
import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { diaSemana } from "@/lib/dates";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/recorrencias/[id]/excecoes — libera uma ocorrência
 * específica da série sem encerrar a recorrência (RF-021 / CA-013).
 */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const db = getDb();
    const rec = db.prepare("SELECT * FROM recorrencias WHERE id = ?").get(Number(id));
    if (!rec) return erro(404, "Recorrência não encontrada.");
    const row = rec as unknown as Record<string, unknown>;

    const b = await lerCorpo<{ data?: string; motivo?: string }>(req);
    const data = b.data || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return erro(400, "Data inválida.");
    if (diaSemana(data) !== Number(row.dia_semana)) {
      return erro(400, "A data informada não corresponde ao dia da semana da recorrência.");
    }
    if (data < String(row.data_inicio)) return erro(400, "Data anterior ao início da vigência.");
    if (row.data_fim && data > String(row.data_fim)) return erro(400, "Data posterior ao fim da vigência.");

    try {
      db.prepare("INSERT INTO excecoes (recorrencia_id, data, tipo, motivo) VALUES (?, ?, 'liberar', ?)").run(
        Number(id),
        data,
        (b.motivo || "").trim() || null
      );
    } catch (e) {
      if (String(e).includes("UNIQUE")) return erro(409, "Esta ocorrência já está liberada.");
      throw e;
    }
    registrarAuditoria(
      sessao.adminId,
      "liberar",
      "ocorrencia",
      Number(id),
      `Liberou a ocorrência de ${data} da recorrência #${id}.`
    );
    return ok({ ok: true }, { status: 201 });
  } catch (e) {
    return tratarErro(e);
  }
}

/**
 * DELETE /api/admin/recorrencias/[id]/excecoes?data=YYYY-MM-DD
 * Reverte a liberação, voltando a bloquear a ocorrência.
 */
export async function DELETE(req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const data = new URL(req.url).searchParams.get("data") || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return erro(400, "Informe a data da exceção.");
    const db = getDb();
    const r = db.prepare("DELETE FROM excecoes WHERE recorrencia_id = ? AND data = ?").run(Number(id), data);
    if (r.changes === 0) return erro(404, "Exceção não encontrada.");
    registrarAuditoria(
      sessao.adminId,
      "reverter",
      "ocorrencia",
      Number(id),
      `Reverteram a liberação de ${data}; horário volta a ser bloqueado.`
    );
    return ok({ ok: true });
  } catch (e) {
    return tratarErro(e);
  }
}
