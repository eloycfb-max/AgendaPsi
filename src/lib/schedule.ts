import { getDb, limpar, limparTodos } from "./db";
import { diaSemana, addDias } from "./dates";
import { HORARIO_FIM, HORARIO_INICIO, ehHoraValida } from "./constants";

/**
 * Regras centrais de agenda (PRD seções 4.3, 5.1–5.4).
 *
 * A recorrência é mantida como entidade principal: as ocorrências são
 * calculadas dinamicamente dentro do período consultado, aplicando as
 * exceções registradas (PRD 8.3). As reservas pontuais (avulsa/reposição)
 * são linhas em `reservas`.
 */

export interface Ocorrencia {
  consultorio_id: number;
  data: string;
  inicio: number;
  fim: number;
  tipo: "fixo" | "avulsa" | "reposicao";
  reserva_id: number | null;
  recorrencia_id: number | null;
  profissional_id: number;
  valor_acordado: number | null;
  observacoes: string | null;
}

/** Ocorrências pontuais (avulsa/reposição) ativas no período */
export function reservasNoPeriodo(
  inicio: string,
  fim: string,
  consultorioId?: number
): Ocorrencia[] {
  const db = getDb();
  const params: unknown[] = [inicio, fim];
  let sql = `SELECT * FROM reservas WHERE situacao = 'ativa' AND data >= ? AND data <= ?`;
  if (consultorioId) {
    sql += " AND consultorio_id = ?";
    params.push(consultorioId);
  }
  const linhas = limparTodos<Record<string, unknown>>(db.prepare(sql).all(...(params as never[])));
  return linhas.map((r) => ({
    consultorio_id: Number(r.consultorio_id),
    data: String(r.data),
    inicio: Number(r.inicio),
    fim: Number(r.fim),
    tipo: r.tipo as "avulsa" | "reposicao",
    reserva_id: Number(r.id),
    recorrencia_id: null,
    profissional_id: Number(r.profissional_id),
    valor_acordado: r.valor_acordado === null ? null : Number(r.valor_acordado),
    observacoes: r.observacoes === null ? null : String(r.observacoes),
  }));
}

/** Ocorrências de horários fixos no período (recorrência − exceções) */
export function recorrenciasNoPeriodo(
  inicio: string,
  fim: string,
  consultorioId?: number
): Ocorrencia[] {
  const db = getDb();
  const params: unknown[] = [];
  let sql = `SELECT * FROM recorrencias WHERE situacao = 'ativa' AND data_inicio <= ? AND (data_fim IS NULL OR data_fim >= ?)`;
  if (consultorioId) {
    sql += " AND consultorio_id = ?";
    params.push(fim, inicio, consultorioId);
  } else {
    params.push(fim, inicio);
  }
  const recs = limparTodos<Record<string, unknown>>(db.prepare(sql).all(...(params as never[])));

  const resultado: Ocorrencia[] = [];
  for (const rec of recs) {
    const recId = Number(rec.id);
    // Exceções (ocorrências liberadas) da recorrência
    const excecoes = new Set(
      limparTodos<{ data: string }>(
        db.prepare("SELECT data FROM excecoes WHERE recorrencia_id = ?").all(recId) as never[]
      ).map((e) => e.data)
    );

    const vigInicio = String(rec.data_inicio);
    const vigFim = rec.data_fim ? String(rec.data_fim) : fim;
    const janelaInício = vigInicio > inicio ? vigInicio : inicio;
    const janelaFim = vigFim < fim ? vigFim : fim;
    const diaRec = Number(rec.dia_semana);
    const inicioRec = Number(rec.inicio);
    const fimRec = Number(rec.fim);

    if (janelaFim < janelaInício) continue;

    // Primeira data da janela com o dia da semana correto
    let data = janelaInício;
    let guard = 0;
    while (data <= janelaFim && diaSemana(data) !== diaRec && guard < 7) {
      data = addDias(data, 1);
      guard++;
    }
    // Ocorrências semanais dentro da janela
    while (data <= janelaFim) {
      if (!excecoes.has(data)) {
        resultado.push({
          consultorio_id: Number(rec.consultorio_id),
          data,
          inicio: inicioRec,
          fim: fimRec,
          tipo: "fixo",
          reserva_id: null,
          recorrencia_id: recId,
          profissional_id: Number(rec.profissional_id),
          valor_acordado: rec.valor_acordado === null ? null : Number(rec.valor_acordado),
          observacoes: rec.observacoes === null ? null : String(rec.observacoes),
        });
      }
      data = addDias(data, 7);
    }
  }
  return resultado;
}

/** Todas as ocorrências do período (fixas + pontuais), com conflito interno sanado */
export function ocorrenciasNoPeriodo(
  inicio: string,
  fim: string,
  consultorioId?: number
): Ocorrencia[] {
  const todas = [
    ...recorrenciasNoPeriodo(inicio, fim, consultorioId),
    ...reservasNoPeriodo(inicio, fim, consultorioId),
  ];
  // Em caso de sobreposição indevida (dado legado), prevalece a fixa
  const vistas = new Set<string>();
  return todas
    .sort((a, b) => (a.tipo === "fixo" ? -1 : 1) - (b.tipo === "fixo" ? -1 : 1))
    .filter((o) => {
      const chave = `${o.consultorio_id}|${o.data}|${o.inicio}`;
      if (vistas.has(chave)) return false;
      vistas.add(chave);
      return true;
    })
    .sort((a, b) => a.data.localeCompare(b.data) || a.inicio - b.inicio);
}

export class ConflitoError extends Error {
  constructor(mensagem = "Horário já ocupado.") {
    super(mensagem);
    this.name = "ConflitoError";
  }
}

/**
 * Verifica se o consultório está livre na data/hora informadas (regra 5.2).
 * `excluir` evita considerar a própria reserva/recorrência em edições.
 */
export function haConflito(
  consultorioId: number,
  data: string,
  inicio: number,
  excluir?: { reservaId?: number; recorrenciaId?: number }
): boolean {
  const db = getDb();

  const reservaConflitante = db
    .prepare(
      "SELECT id FROM reservas WHERE consultorio_id = ? AND data = ? AND inicio = ? AND situacao = 'ativa' AND id != ?"
    )
    .get(consultorioId, data, inicio, excluir?.reservaId ?? -1);
  if (reservaConflitante) return true;

  // Recorrências ativas que abrangem esta data/hora
  const dow = diaSemana(data);
  if (dow >= 1 && dow <= 6) {
    const recs = limparTodos<Record<string, unknown>>(
      db
        .prepare(
          `SELECT id, inicio FROM recorrencias
           WHERE consultorio_id = ? AND dia_semana = ? AND situacao = 'ativa'
             AND data_inicio <= ? AND (data_fim IS NULL OR data_fim >= ?)
             AND id != ?`
        )
        .all(consultorioId, dow, data, data, excluir?.recorrenciaId ?? -1) as never[]
    );
    for (const rec of recs) {
      if (Number(rec.inicio) !== inicio) continue;
      const excecao = db
        .prepare("SELECT id FROM excecoes WHERE recorrencia_id = ? AND data = ?")
        .get(Number(rec.id), data);
      if (!excecao) return true;
    }
  }
  return false;
}

/**
 * validaGrade: regra 5.1 — bloco de hora cheia entre 07h e 21h,
 * segunda a sábado, duração de 1 hora.
 */
export function validarGrade(data: string, inicio: number, fim: number): string | null {
  const dow = diaSemana(data);
  if (dow === 0) return "Domingos não podem ser reservados (RF-010).";
  if (!ehHoraValida(inicio)) return "Horário inicial fora da grade (07h às 20h).";
  if (fim !== inicio + 1) return "A reserva deve durar exatamente 1 hora (RF-008).";
  if (inicio + 1 > HORARIO_FIM) return "O último horário permitido é das 20h às 21h (RF-009).";
  if (inicio < HORARIO_INICIO) return "Horário anterior ao funcionamento (07h).";
  return null;
}

/**
 * Lista datas de uma recorrência dentro da vigência (para validação
 * completa de conflitos no cadastro — PRD 5.3).
 */
export function datasDaRecorrencia(
  diaSemanaRec: number,
  dataInicio: string,
  dataFim: string | null,
  limiteFim: string
): string[] {
  const fim = dataFim && dataFim < limiteFim ? dataFim : limiteFim;
  if (fim < dataInicio) return [];
  const datas: string[] = [];
  let data = dataInicio;
  let guard = 0;
  while (data <= fim && guard < 4000) {
    if (diaSemana(data) === diaSemanaRec) datas.push(data);
    data = addDias(data, 1);
    guard++;
  }
  return datas;
}

/** Verifica conflito de uma recorrência completa contra reservas e outras recorrências. */
export function validarConflitoRecorrencia(
  recorrencia: {
    id?: number;
    consultorio_id: number;
    dia_semana: number;
    inicio: number;
    data_inicio: string;
    data_fim: string | null;
  },
  limiteFim: string
): { conflito: boolean; data?: string } {
  const datas = datasDaRecorrencia(
    recorrencia.dia_semana,
    recorrencia.data_inicio,
    recorrencia.data_fim,
    limiteFim
  );
  for (const data of datas) {
    if (
      haConflito(recorrencia.consultorio_id, data, recorrencia.inicio, {
        recorrenciaId: recorrencia.id,
      })
    ) {
      return { conflito: true, data };
    }
  }
  return { conflito: false };
}
