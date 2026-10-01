import { getDb, limparTodos } from "@/lib/db";
import { ok, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { ocorrenciasNoPeriodo } from "@/lib/schedule";
import { hojeIso, addDias, formatarData } from "@/lib/dates";
import { indicadoresFinanceiros } from "@/lib/finance";

/** GET /api/admin/dashboard — visão geral (RF-041) */
export async function GET(): Promise<Response> {
  try {
    await exigirSessao();
    const db = getDb();
    const hoje = hojeIso();
    const daqui7 = addDias(hoje, 7);

    const consultorios = limparTodos<{ id: number; nome: string }>(
      db.prepare("SELECT id, nome FROM consultorios ORDER BY id").all() as never[]
    );
    const profissionais = new Map(
      limparTodos<{ id: number; nome_completo: string }>(
        db.prepare("SELECT id, nome_completo FROM profissionais").all() as never[]
      ).map((p) => [p.id, p.nome_completo])
    );

    // Reservas do dia + próximas 7 dias
    const doDia = ocorrenciasNoPeriodo(hoje, hoje);
    const proximas = ocorrenciasNoPeriodo(addDias(hoje, 1), daqui7).slice(0, 12);

    const solicitacoesPendentes = limparTodos<Record<string, unknown>>(
      db
        .prepare(
          `SELECT s.*, c.nome AS nome_consultorio FROM solicitacoes s
           JOIN consultorios c ON c.id = s.consultorio_id
           WHERE s.situacao = 'pendente' ORDER BY s.data, s.inicio LIMIT 20`
        )
        .all() as never[]
    );

    const fixosAtivos = limparTodos<Record<string, unknown>>(
      db
        .prepare(
          `SELECT r.*, c.nome AS nome_consultorio, p.nome_completo FROM recorrencias r
           JOIN consultorios c ON c.id = r.consultorio_id
           JOIN profissionais p ON p.id = r.profissional_id
           WHERE r.situacao = 'ativa' ORDER BY r.dia_semana, r.inicio`
        )
        .all() as never[]
    );

    // Receita do mês (pagamentos recebidos no mês corrente de São Paulo)
    const hojeUtc = new Date();
    const mesAtual = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
    }).format(hojeUtc);
    const receitaMes = db
      .prepare(
        `SELECT COALESCE(SUM(valor), 0) AS total FROM pagamentos
         WHERE strftime('%Y-%m', data_pagamento) = ?`
      )
      .get(mesAtual) as { total: number };
    const previstoMes = db
      .prepare(
        `SELECT COALESCE(SUM(valor_cobrado), 0) AS total FROM lancamentos
         WHERE strftime('%Y-%m', data_referencia) = ? AND situacao != 'cancelado'`
      )
      .get(mesAtual) as { total: number };

    const financeiro = indicadoresFinanceiros({ de: addDias(hoje, -90) });

    return ok({
      hoje,
      rotulo_hoje: formatarData(hoje),
      reservas_do_dia: doDia.map((o) => ({
        ...o,
        nome_profissional: profissionais.get(o.profissional_id) ?? "—",
        nome_consultorio: consultorios.find((c) => c.id === o.consultorio_id)?.nome ?? "—",
      })),
      proximas_reservas: proximas.map((o) => ({
        ...o,
        nome_profissional: profissionais.get(o.profissional_id) ?? "—",
        nome_consultorio: consultorios.find((c) => c.id === o.consultorio_id)?.nome ?? "—",
      })),
      solicitacoes_pendentes: solicitacoesPendentes.map((s) => ({
        id: Number(s.id),
        nome: String(s.nome),
        telefone: String(s.telefone),
        data: String(s.data),
        inicio: Number(s.inicio),
        tipo: String(s.tipo),
        nome_consultorio: String(s.nome_consultorio),
      })),
      fixos_ativos: fixosAtivos.map((r) => ({
        id: Number(r.id),
        dia_semana: Number(r.dia_semana),
        inicio: Number(r.inicio),
        nome_consultorio: String(r.nome_consultorio),
        nome_profissional: String(r.nome_completo),
        data_fim: r.data_fim === null ? null : String(r.data_fim),
      })),
      financeiro: {
        receita_mes: Number(receitaMes.total),
        previsto_mes: Number(previstoMes.total),
        pendente: financeiro.pendente,
        atrasado: financeiro.atrasado,
        recebida_90d: financeiro.recebida,
      },
    });
  } catch (e) {
    return tratarErro(e);
  }
}
