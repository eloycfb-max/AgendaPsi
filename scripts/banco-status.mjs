// Mostra o nome e o nº de linhas de cada tabela do banco (verificação de entrega).
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("data/agenda.db");
const tabs = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
  .all()
  .map((r) => r.name);
for (const t of tabs) {
  console.log(`${t}: ${db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c}`);
}
db.close();
