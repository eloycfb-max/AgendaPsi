import { getDb } from "@/lib/db";
import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { validarGrade } from "@/lib/schedule";
import { hojeIso } from "@/lib/dates";

/**
 * POST /api/public/solicitacoes
 * Registra a solicitação do visitante com status "pendente" (RF-037).
 * Não cria reserva: a confirmação é manual e revalida disponibilidade (RF-036/RF-038).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = await lerCorpo<{
      nome?: string;
      telefone?: string;
      consultorio_id?: number;
      data?: string;
      inicio?: number;
      tipo?: string;
    }>(req);

    const nome = (body.nome || "").trim();
    const telefone = (body.telefone || "").trim();
    const consultorioId = Number(body.consultorio_id);
    const data = body.data || "";
    const inicio = Number(body.inicio);
    const tipo = body.tipo || "avulsa";

    if (nome.length < 3) return erro(400, "Informe seu nome completo (mínimo 3 caracteres).");
    if (telefone.replace(/\D/g, "").length < 10) return erro(400, "Informe um telefone válido com DDD.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return erro(400, "Data inválida.");
    if (!["fixo", "avulsa", "reposicao"].includes(tipo)) return erro(400, "Tipo de sublocação inválido.");

    const problema = validarGrade(data, inicio, inicio + 1);
    if (problema) return erro(400, problema);
    if (data < hojeIso()) return erro(400, "Não é possível solicitar datas passadas.");

    const db = getDb();
    const sala = db
      .prepare("SELECT id FROM consultorios WHERE id = ? AND situacao = 'ativo'")
      .get(consultorioId);
    if (!sala) return erro(404, "Consultório não encontrado.");

    const r = db
      .prepare(
        `INSERT INTO solicitacoes (nome, telefone, consultorio_id, data, inicio, fim, tipo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(nome, telefone, consultorioId, data, inicio, inicio + 1, tipo);

    return ok(
      { ok: true, id: Number(r.lastInsertRowid), situacao: "pendente" },
      { status: 201 }
    );
  } catch (e) {
    return tratarErro(e);
  }
}
