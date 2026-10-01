import { getDb } from "@/lib/db";
import { ok, erro, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

type Params = { params: Promise<{ id: string }> };

const EXTENSOES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/avif", ".avif"],
]);
const TAMANHO_MAX = 8 * 1024 * 1024; // 8 MB

/** POST /api/admin/consultorios/[id]/fotos — upload multipart (RF-055) */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const db = getDb();
    const sala = db.prepare("SELECT id FROM consultorios WHERE id = ?").get(Number(id));
    if (!sala) return erro(404, "Consultório não encontrado.");

    const form = await req.formData();
    const arquivo = form.get("arquivo");
    const alt = String(form.get("alt") || "").trim();
    if (!(arquivo instanceof File)) return erro(400, "Nenhum arquivo enviado.");
    const ext = EXTENSOES.get(arquivo.type);
    if (!ext) return erro(400, "Formato não suportado. Use JPG, PNG, WEBP ou AVIF.");
    if (arquivo.size > TAMANHO_MAX) return erro(400, "Arquivo maior que 8 MB.");

    const nomeArquivo = `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
    const dir = path.join(process.cwd(), "data", "uploads");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, nomeArquivo), Buffer.from(await arquivo.arrayBuffer()));

    const ordem = ((db
      .prepare("SELECT COALESCE(MAX(ordem), 0) AS max FROM fotos WHERE consultorio_id = ?")
      .get(Number(id)) as { max: number }).max ?? 0) + 1;

    const r = db
      .prepare("INSERT INTO fotos (consultorio_id, arquivo, alt, ordem) VALUES (?, ?, ?, ?)")
      .run(Number(id), nomeArquivo, alt || `Foto do consultório`, ordem);
    registrarAuditoria(sessao.adminId, "criar", "foto", Number(r.lastInsertRowid), `Adicionou foto ao consultório #${id}.`);
    return ok({ ok: true, id: Number(r.lastInsertRowid), url: `/api/arquivos/${nomeArquivo}` }, { status: 201 });
  } catch (e) {
    return tratarErro(e);
  }
}
