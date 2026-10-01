import { getDb, limparTodos } from "@/lib/db";
import { ok, erro, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { ocorrenciasNoPeriodo } from "@/lib/schedule";
import { addDias, hojeIso, formatarData } from "@/lib/dates";
import { indicadoresFinanceiros, carregarLancamento } from "@/lib/finance";
import { DIAS_SEMANA } from "@/lib/constants";

/**
 * GET /api/admin/relatorios?de=YYYY-MM-DD&ate=YYYY-MM-DD
 * Indicadores de ocupação e receita (RF-050 / MOD-09).
 */
export async function GET(req: Request): Promise<Response> {
  try {
    await exigirSessao();
    const url = new URL(req.url);
    const hoje = hojeIso();
    const de = url.searchParams.get("de") || addDias(hoje, -30);
    const ate = url.searchParams.get("ate") || hoje;
    if (de > ate) return erro(400, "Período inválido: início posterior ao fim.");

    const db = getDb();
    const consultorios = limparTodos<{ id: number; nome: string }>(
      db.prepare("SELECT id, nome FROM consultorios ORDER BY id").all() as never[]
    );
    const ocorrencias = ocorrenciasNoPeriodo(de, ate);

    // Ocupação: horas de segunda a sábado, 07h–21h (14h/dia por sala)
    let diasCalendario = 0;
    {
      let d = de;
      while (d <= ate) {
        const dow = new Date(d + "T12:00:00Z").getUTCDay();
        if (dow !== 0) diasCalendario++;
        d = addDias(d, 1);
      }
    }
    const horasPorDia = 14;

    const ocupacao = consultorios.map((c) => {
      const doSala = ocorrencias.filter((o) => o.consultorio_id === c.id);
      const total = diasCalendario * horasPorDia;
      const ocupadas = doSala.length;
      return {
        consultorio_id: c.id,
        consultorio: c.nome,
        horas_disponiveis: total,
        horas_ocupadas: ocupadas,
        percentual: total > 0 ? Math.round((ocupadas / total) * 1000) / 10 : 0,
      };
    });

    const porDiaSemana = DIAS_SEMANA.map((d) => ({
      dia: d.longo,
      quantidade: ocorrencias.filter((o) => {
        const dow = new Date(o.data + "T12:00:00Z").getUTCDay();
        return dow === d.numero;
      }).length,
    }));

    const porTipo = (["fixo", "avulsa", "reposicao"] as const).map((t) => ({
      tipo: t,
      quantidade: ocorrencias.filter((o) => o.tipo === t).length,
    }));

    const financeiro = indicadoresFinanceiros({ de, ate });

    // Receita por consultório com nomes
    const receitaPorConsultorio = financeiro.porConsultorio.map((p) => ({
      consultorio: consultorios.find((c) => c.id === p.consultorio_id)?.nome ?? `#${p.consultorio_id}`,
      prevista: p.prevista,
      recebida: p.recebida,
    }));

    const profissionais = limparTodos<{ id: number; nome_completo: string }>(
      db.prepare("SELECT id, nome_completo FROM profissionais").all() as never[]
    );
    const receitaPorProfissional = financeiro.porProfissional.map((p) => ({
      profissional: profissionais.find((x) => x.id === p.profissional_id)?.nome_completo ?? `#${p.profissional_id}`,
      prevista: p.prevista,
      recebida: p.recebida,
    }));

    return ok({
      periodo: { de, ate, rotulo: `${formatarData(de)} a ${formatarData(ate)}` },
      ocupacao,
      total_horas_ocupadas: ocupacao.reduce((s, o) => s + o.horas_ocupadas, 0),
      por_dia_semana: porDiaSemana,
      por_tipo: porTipo,
      financeiro: {
        prevista: financeiro.prevista,
        recebida: financeiro.recebida,
        pendente: financeiro.pendente,
        atrasado: financeiro.atrasado,
        por_consultorio: receitaPorConsultorio,
        por_profissional: receitaPorProfissional,
      },
      lancamentos: (limparTodos<{ id: number }>(
        db
          .prepare("SELECT id FROM lancamentos WHERE data_referencia >= ? AND data_referencia <= ? ORDER BY data_referencia DESC")
          .all(de, ate) as never[]
      )).map((l) => carregarLancamento(l.id)!),
    });
  } catch (e) {
    return tratarErro(e);
  }
}
