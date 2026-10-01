import { getDb, limparTodos } from "@/lib/db";
import { ok, erro, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { ocorrenciasNoPeriodo } from "@/lib/schedule";
import { addDias } from "@/lib/dates";

/**
 * GET /api/admin/agenda?inicio=YYYY-MM-DD&dias=7
 * Visão completa da semana para o administrador: ocorrências com tipo,
 * profissional e observações + solicitações pendentes (RF-042).
 */
export async function GET(req: Request): Promise<Response> {
  try {
    await exigirSessao();
    const url = new URL(req.url);
    const hoje = new Date().toISOString().slice(0, 10);
    const inicio = url.searchParams.get("inicio") || hoje;
    const dias = Math.min(Math.max(Number(url.searchParams.get("dias") || 7), 1), 31);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) return erro(400, "Data inicial inválida.");
    const fim = addDias(inicio, dias - 1);

    const db = getDb();
    const consultorios = limparTodos<Record<string, unknown>>(
      db.prepare("SELECT id, nome, slug FROM consultorios ORDER BY id").all() as never[]
    );
    const profissionais = new Map(
      limparTodos<Record<string, unknown>>(
        db.prepare("SELECT id, nome_completo, situacao FROM profissionais").all() as never[]
      ).map((p) => [Number(p.id), String(p.nome_completo)])
    );

    const ocorrencias = ocorrenciasNoPeriodo(inicio, fim);
    const solicitacoes = limparTodos<Record<string, unknown>>(
      db
        .prepare(
          `SELECT s.*, c.nome AS nome_consultorio FROM solicitacoes s
           JOIN consultorios c ON c.id = s.consultorio_id
           WHERE s.situacao = 'pendente' AND s.data >= ? AND s.data <= ?
           ORDER BY s.data, s.inicio`
        )
        .all(inicio, fim) as never[]
    );

    const recorrenciasAtivas = limparTodos<Record<string, unknown>>(
      db
        .prepare(
          `SELECT r.id, r.dia_semana, r.inicio, r.data_inicio, r.data_fim, r.situacao,
                  c.nome AS nome_consultorio, p.nome_completo AS nome_profissional
           FROM recorrencias r
           JOIN consultorios c ON c.id = r.consultorio_id
           JOIN profissionais p ON p.id = r.profissional_id
           WHERE r.situacao = 'ativa'
           ORDER BY r.dia_semana, r.inicio`
        )
        .all() as never[]
    );

    return ok({
      inicio,
      fim,
      consultorios: consultorios.map((c) => ({ id: Number(c.id), nome: String(c.nome), slug: String(c.slug) })),
      ocorrencias: ocorrencias.map((o) => ({
        consultorio_id: o.consultorio_id,
        data: o.data,
        inicio: o.inicio,
        fim: o.fim,
        tipo: o.tipo,
        reserva_id: o.reserva_id,
        recorrencia_id: o.recorrencia_id,
        profissional_id: o.profissional_id,
        nome_profissional: profissionais.get(o.profissional_id) ?? "—",
        valor_acordado: o.valor_acordado,
        observacoes: o.observacoes,
      })),
      solicitacoes: solicitacoes.map((s) => ({
        id: Number(s.id),
        nome: String(s.nome),
        telefone: String(s.telefone),
        consultorio_id: Number(s.consultorio_id),
        nome_consultorio: String(s.nome_consultorio),
        data: String(s.data),
        inicio: Number(s.inicio),
        fim: Number(s.fim),
        tipo: String(s.tipo),
        situacao: String(s.situacao),
        created_at: String(s.created_at),
      })),
      recorrencias: recorrenciasAtivas.map((r) => ({
        id: Number(r.id),
        dia_semana: Number(r.dia_semana),
        inicio: Number(r.inicio),
        data_inicio: String(r.data_inicio),
        data_fim: r.data_fim === null ? null : String(r.data_fim),
        nome_consultorio: String(r.nome_consultorio),
        nome_profissional: String(r.nome_profissional),
      })),
    });
  } catch (e) {
    return tratarErro(e);
  }
}
