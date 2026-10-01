import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

/**
 * Camada de dados — SQLite (node:sqlite, nativo do Node 24).
 * O banco fica em ./data/agenda.db e é criado automaticamente.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS administradores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  situacao TEXT NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo','inativo')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profissionais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_completo TEXT NOT NULL,
  profissao TEXT NOT NULL DEFAULT '',
  telefone TEXT NOT NULL DEFAULT '',
  email TEXT,
  situacao TEXT NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo','inativo')),
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS consultorios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL DEFAULT '',
  recursos TEXT NOT NULL DEFAULT '',
  situacao TEXT NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo','inativo')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fotos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consultorio_id INTEGER NOT NULL REFERENCES consultorios(id) ON DELETE CASCADE,
  arquivo TEXT NOT NULL,
  alt TEXT NOT NULL DEFAULT '',
  ordem INTEGER NOT NULL DEFAULT 0,
  situacao TEXT NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo','inativo'))
);

CREATE TABLE IF NOT EXISTS precos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consultorio_id INTEGER NOT NULL REFERENCES consultorios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('fixo','avulsa','reposicao')),
  valor_cents INTEGER NOT NULL CHECK (valor_cents >= 0), -- 0 = tipo não cobrado (ex.: reposição)
  vigencia_inicio TEXT NOT NULL,
  vigencia_fim TEXT,
  situacao TEXT NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo','inativo')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recorrencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consultorio_id INTEGER NOT NULL REFERENCES consultorios(id),
  profissional_id INTEGER NOT NULL REFERENCES profissionais(id),
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 6),
  inicio INTEGER NOT NULL CHECK (inicio >= 7 AND inicio <= 20),
  fim INTEGER NOT NULL,
  data_inicio TEXT NOT NULL,
  data_fim TEXT,
  situacao TEXT NOT NULL DEFAULT 'ativa' CHECK (situacao IN ('ativa','encerrada')),
  valor_acordado INTEGER,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS excecoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recorrencia_id INTEGER NOT NULL REFERENCES recorrencias(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'liberar' CHECK (tipo IN ('liberar')),
  motivo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (recorrencia_id, data)
);

CREATE TABLE IF NOT EXISTS reservas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consultorio_id INTEGER NOT NULL REFERENCES consultorios(id),
  profissional_id INTEGER NOT NULL REFERENCES profissionais(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('avulsa','reposicao')),
  data TEXT NOT NULL,
  inicio INTEGER NOT NULL CHECK (inicio >= 7 AND inicio <= 20),
  fim INTEGER NOT NULL,
  situacao TEXT NOT NULL DEFAULT 'ativa' CHECK (situacao IN ('ativa','cancelada')),
  valor_acordado INTEGER,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Unicidade de ocupação no nível do banco (regra 5.2 / RNF-003)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservas_unicas
  ON reservas(consultorio_id, data, inicio)
  WHERE situacao = 'ativa';

CREATE INDEX IF NOT EXISTS idx_reservas_data ON reservas(data);
CREATE INDEX IF NOT EXISTS idx_recorrencias_dia ON recorrencias(dia_semana, situacao);

CREATE TABLE IF NOT EXISTS solicitacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  consultorio_id INTEGER NOT NULL REFERENCES consultorios(id),
  data TEXT NOT NULL,
  inicio INTEGER NOT NULL,
  fim INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('fixo','avulsa','reposicao')),
  situacao TEXT NOT NULL DEFAULT 'pendente' CHECK (situacao IN ('pendente','confirmada','recusada')),
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lancamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profissional_id INTEGER NOT NULL REFERENCES profissionais(id),
  reserva_id INTEGER REFERENCES reservas(id),
  consultorio_id INTEGER NOT NULL REFERENCES consultorios(id),
  data_referencia TEXT NOT NULL,
  valor_cobrado INTEGER NOT NULL CHECK (valor_cobrado >= 0),
  vencimento TEXT,
  situacao TEXT NOT NULL DEFAULT 'pendente' CHECK (situacao IN ('pendente','pago','parcial','atrasado','cancelado')),
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pagamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lancamento_id INTEGER NOT NULL REFERENCES lancamentos(id) ON DELETE CASCADE,
  valor INTEGER NOT NULL CHECK (valor > 0),
  data_pagamento TEXT NOT NULL,
  forma TEXT NOT NULL,
  referencia TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id INTEGER,
  resumo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const arquivo = path.join(dir, "agenda.db");
  db = new DatabaseSync(arquivo);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  migrarPrecosPermitindoZero(db);
  seed(db);
  return db;
}

/**
 * Bancos criados antes do suporte a "reposição grátis" têm CHECK (valor_cents > 0)
 * em precos. Recria a tabela com CHECK (valor_cents >= 0) preservando os dados.
 */
function migrarPrecosPermitindoZero(d: DatabaseSync) {
  const row = d
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='precos'")
    .get() as { sql?: string } | undefined;
  if (!row?.sql || !row.sql.includes("valor_cents > 0")) return;
  d.exec(`
    CREATE TABLE precos_novo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consultorio_id INTEGER NOT NULL REFERENCES consultorios(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL CHECK (tipo IN ('fixo','avulsa','reposicao')),
      valor_cents INTEGER NOT NULL CHECK (valor_cents >= 0),
      vigencia_inicio TEXT NOT NULL,
      vigencia_fim TEXT,
      situacao TEXT NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo','inativo')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO precos_novo (id, consultorio_id, tipo, valor_cents, vigencia_inicio, vigencia_fim, situacao, created_at, updated_at)
      SELECT id, consultorio_id, tipo, valor_cents, vigencia_inicio, vigencia_fim, situacao, created_at, updated_at FROM precos;
    DROP TABLE precos;
    ALTER TABLE precos_novo RENAME TO precos;
  `);
}

/**
 * Seed inicial: 3 consultórios + administrador padrão.
 * A senha padrão é documentada no README e deve ser trocada no primeiro acesso.
 */
function seed(db: DatabaseSync) {
  const temAdmin = db.prepare("SELECT COUNT(*) AS n FROM administradores").get() as { n: number };
  if (temAdmin.n === 0) {
    const hash = bcrypt.hashSync(process.env.ADMIN_SENHA_INICIAL || "humana@2026", 10);
    db.prepare(
      "INSERT INTO administradores (nome, email, senha_hash) VALUES (?, ?, ?)"
    ).run("Eloy Bezerra", "admin@humamentepsi.com", hash);
  }

  const temSala = db.prepare("SELECT COUNT(*) AS n FROM consultorios").get() as { n: number };
  if (temSala.n === 0) {
    const insert = db.prepare(
      "INSERT INTO consultorios (nome, slug, descricao, recursos) VALUES (?, ?, ?, ?)"
    );
    insert.run(
      "Consultório 01",
      "consultorio-01",
      "Consultório acolhedor com iluminação natural, ideal para atendimentos individuais.",
      "Ar-condicionado; Wi-Fi; Mesa; Cadeiras; Tomadas"
    );
    insert.run(
      "Consultório 02",
      "consultorio-02",
      "Espaço amplo e silencioso, confortável para sessões e atendimentos prolongados.",
      "Ar-condicionado; Wi-Fi; Poltrona; Mesa; Cortinas opacas"
    );
    insert.run(
      "Consultório 03",
      "consultorio-03",
      "Consultório compacto e funcional, perfeito para quem procura um ambiente simples e privativo.",
      "Ar-condicionado; Wi-Fi; Mesa; Duas cadeiras"
    );
  }
}

/** Executa uma função dentro de transação (BEGIN IMMEDIATE). */
export function transacao<T>(fn: () => T): T {
  const d = getDb();
  d.exec("BEGIN IMMEDIATE");
  try {
    const resultado = fn();
    d.exec("COMMIT");
    return resultado;
  } catch (erro) {
    d.exec("ROLLBACK");
    throw erro;
  }
}

/** Converte linha do SQLite (null prototype) em objeto comum */
export function limpar<T>(linha: unknown): T {
  return { ...(linha as object) } as T;
}

export function limparTodos<T>(linhas: unknown[]): T[] {
  return linhas.map((l) => ({ ...(l as object) }) as T);
}
