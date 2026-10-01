import { readFile } from "node:fs/promises";
import path from "node:path";
import { erro } from "@/lib/http";

type Params = { params: Promise<{ nome: string }> };

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

/**
 * GET /api/arquivos/[nome] — serve as fotos enviadas pelo administrador.
 * Restrito ao diretório data/uploads (não permite traversal).
 */
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { nome } = await params;
  const seguro = path.basename(nome); // impede "../"
  const ext = path.extname(seguro).toLowerCase();
  const mime = MIME[ext];
  if (!mime) return erro(404, "Arquivo não encontrado.");
  try {
    const buffer = await readFile(path.join(process.cwd(), "data", "uploads", seguro));
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return erro(404, "Arquivo não encontrado.");
  }
}
