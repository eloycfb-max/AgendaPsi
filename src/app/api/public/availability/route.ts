import { getDb, limparTodos } from "@/lib/db";
import { ok, erro, tratarErro } from "@/lib/http";
import { ocorrenciasNoPeriodo } from "@/lib/schedule";
import { addDias, diaSemana, formatarData, hojeIso } from "@/lib/dates";
import { HORARIO_FIM, HORARIO_INICIO } from "@/lib/constants";

/**
 * GET /api/public/availability?inicio=YYYY-MM-DD&dias=7
 *
 * Devolve a grade dos consultórios com status "livre", "ocupado" ou
 * "bloqueado" (domingo e datas já passadas — não podem ser solicitadas).
 * Por privacidade (RF-016 / CA-007), NÃO retorna nomes de profissionais,
 * tipos de reserva nem valores.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const hoje = hojeIso();
    const inicio = url.searchParams.get("inicio") || hoje;
    const dias = Math.min(Math.max(Number(url.searchParams.get("dias") || 7), 1), 28);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) return erro(400, "Data inicial inválida.");

    const fim = addDias(inicio, dias - 1);
    const db = getDb();

    const consultorios = limparTodos<{ id: number; nome: string; slug: string }>(
      db
        .prepare("SELECT id, nome, slug FROM consultorios WHERE situacao = 'ativo' ORDER BY id")
        .all() as never[]
    );

    const datas: string[] = [];
    for (let i = 0; i < dias; i++) datas.push(addDias(inicio, i));

    const ocupacoes = ocorrenciasNoPeriodo(inicio, fim);
    const porChave = new Map<string, boolean>();
    for (const o of ocupacoes) {
      porChave.set(`${o.consultorio_id}|${o.data}|${o.inicio}`, true);
    }

    const resultado = consultorios.map((c) => ({
      id: c.id,
      nome: c.nome,
      slug: c.slug,
      dias: datas.map((data) => ({
        data,
        dow: diaSemana(data),
        rotulo: formatarData(data),
        domingo: diaSemana(data) === 0,
        horarios: Array.from({ length: HORARIO_FIM - HORARIO_INICIO }, (_, i) => {
          const hora = HORARIO_INICIO + i;
          return {
            hora,
            status:
              diaSemana(data) === 0 || data < hoje
                ? "bloqueado"
                : porChave.has(`${c.id}|${data}|${hora}`)
                  ? "ocupado"
                  : "livre",
          };
        }),
      })),
    }));

    return ok({ inicio, fim, consultorios: resultado });
  } catch (e) {
    return tratarErro(e);
  }
}
