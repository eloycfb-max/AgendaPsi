import { getDb, limparTodos } from "@/lib/db";
import { erro, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { ocorrenciasNoPeriodo } from "@/lib/schedule";
import { addDias, hojeIso, formatarData } from "@/lib/dates";
import { carregarLancamento, indicadoresFinanceiros } from "@/lib/finance";
import { DIAS_SEMANA, SITUACOES_FINANCEIRAS, TIPOS_RESERVA } from "@/lib/constants";

/**
 * GET /api/admin/relatorios/exportar?conjunto=lancamentos|ocupacao&de=&ate=&...
 * Exporta CSV (UTF-8 com BOM para Excel) contendo SOMENTE os registros dos
 * filtros aplicados (RF-052 / CA-014).
 */
export async function GET(req: Request): Promise<Response> {
  try {
    await exigirSessao();
    const url = new URL(req.url);
    const conjunto = url.searchParams.get("conjunto") || "lancamentos";
    const hoje = hojeIso();
    const de = url.searchParams.get("de") || addDias(hoje, -30);
    const ate = url.searchParams.get("ate") || hoje;
    if (de > ate) return erro(400, "Período inválido.");

    let csv = "";
    let nomeArquivo = "";

    if (conjunto === "lancamentos") {
      const cond: string[] = ["l.data_referencia >= ?", "l.data_referencia <= ?"];
      const params: unknown[] = [de, ate];
      if (url.searchParams.get("profissional_id")) {
        cond.push("l.profissional_id = ?");
        params.push(Number(url.searchParams.get("profissional_id")));
      }
      if (url.searchParams.get("consultorio_id")) {
        cond.push("l.consultorio_id = ?");
        params.push(Number(url.searchParams.get("consultorio_id")));
      }
      const db = getDb();
      const ids = db
        .prepare(`SELECT l.id FROM lancamentos l WHERE ${cond.join(" AND ")} ORDER BY l.data_referencia, l.id`)
        .all(...(params as never[])) as { id: number }[];
      let lancamentos = ids.map((i) => carregarLancamento(Number(i.id))!);
      const situacao = url.searchParams.get("situacao");
      if (situacao && situacao !== "todas") {
        lancamentos = lancamentos.filter((l) => l.situacao_efetiva === situacao);
      }

      const cabecalho = [
        "ID",
        "Profissional",
        "Consultório",
        "Data de referência",
        "Vencimento",
        "Valor cobrado",
        "Valor recebido",
        "Saldo pendente",
        "Situação",
        "Pagamentos",
        "Observações",
      ];
      const linhas = lancamentos.map((l) => [
        String(l.id),
        l.nome_profissional,
        l.nome_consultorio,
        l.data_referencia,
        l.vencimento ?? "",
        brl(l.valor_cobrado),
        brl(l.valor_pago),
        brl(l.saldo),
        SITUACOES_FINANCEIRAS[l.situacao_efetiva],
        l.pagamentos
          .map((p) => `${formatarData(p.data_pagamento)} ${brl(p.valor)} (${p.forma})`)
          .join(" | "),
        (l.observacoes ?? "").replace(/\n/g, " "),
      ]);
      csv = montarCsv(cabecalho, linhas);
      nomeArquivo = `lancamentos_${de}_${ate}.csv`;
    } else if (conjunto === "ocupacao") {
      const ocorrencias = ocorrenciasNoPeriodo(de, ate);
      const db = getDb();
      const consultorios = limparTodos<{ id: number; nome: string }>(
        db.prepare("SELECT id, nome FROM consultorios ORDER BY id").all() as never[]
      );
      const nomes = new Map(
        limparTodos<{ id: number; nome_completo: string }>(
          db.prepare("SELECT id, nome_completo FROM profissionais").all() as never[]
        ).map((p) => [p.id, p.nome_completo])
      );
      const cabecalho = ["Data", "Dia da semana", "Consultório", "Horário", "Tipo", "Profissional"];
      const linhas = ocorrencias.map((o) => [
        o.data,
        DIAS_SEMANA.find((d) => d.numero === new Date(o.data + "T12:00:00Z").getUTCDay())?.longo ?? "",
        consultorios.find((c) => c.id === o.consultorio_id)?.nome ?? "",
        `${String(o.inicio).padStart(2, "0")}:00 - ${String(o.fim).padStart(2, "0")}:00`,
        TIPOS_RESERVA[o.tipo].rotulo,
        nomes.get(o.profissional_id) ?? "",
      ]);
      csv = montarCsv(cabecalho, linhas);
      nomeArquivo = `ocupacao_${de}_${ate}.csv`;
    } else {
      return erro(400, "Conjunto inválido: use lancamentos ou ocupacao.");
    }

    return new Response("\uFEFF" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return tratarErro(e);
  }
}

function brl(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function montarCsv(cabecalho: string[], linhas: string[][]): string {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  return [cabecalho.map(esc).join(";"), ...linhas.map((l) => l.map(esc).join(";"))].join("\r\n");
}
