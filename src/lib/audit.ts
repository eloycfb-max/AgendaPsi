import { getDb } from "./db";

/**
 * Registra uma operação administrativa relevante (RNF-011 / RF-045).
 */
export function registrarAuditoria(
  adminId: number | null,
  acao: string,
  entidade: string,
  entidadeId: number | null,
  resumo: string
): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO auditoria (admin_id, acao, entidade, entidade_id, resumo) VALUES (?, ?, ?, ?, ?)"
  ).run(adminId, acao, entidade, entidadeId, resumo);
}
