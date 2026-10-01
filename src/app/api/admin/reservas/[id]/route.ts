import { getDb, transacao } from "@/lib/db";
import { ok, erro, lerCorpo, tratarErro } from "@/lib/http";
import { exigirSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { ConflitoError, haConflito, validarGrade } from "@/lib/schedule";
import { paraCentavos } from "@/lib/dates";

type Params = { params: Promise<{ id: string }> };

/** PUT /api/admin/reservas/[id] — edita data/hora/profissional/valor com revalidação */
export async function PUT(req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const db = getDb();
    const atual = db.prepare("SELECT * FROM reservas WHERE id = ?").get(Number(id));
    if (!atual) return erro(404, "Reserva não encontrada.");
    const row = atual as unknown as Record<string, unknown>;
    if (row.situacao === "cancelada") return erro(409, "Reserva cancelada não pode ser editada.");

    const b = await lerCorpo<{
      profissional_id?: number;
      data?: string;
      inicio?: number;
      observacoes?: string;
      valor?: string | number;
    }>(req);

    const profissionalId = Number(b.profissional_id ?? row.profissional_id);
    const data = b.data ?? String(row.data);
    const inicio = Number(b.inicio ?? row.inicio);
    const problema = validarGrade(data, inicio, inicio + 1);
    if (problema) return erro(400, problema);

    const prof = db.prepare("SELECT situacao FROM profissionais WHERE id = ?").get(profissionalId) as
      | { situacao: string }
      | undefined;
    if (!prof) return erro(400, "Profissional inválido.");
    if (prof.situacao !== "ativo") return erro(400, "Profissional inativo não pode receber reservas (RF-030).");

    let valorAcordado = row.valor_acordado === null ? null : Number(row.valor_acordado);
    if (b.valor !== undefined && b.valor !== "") {
      try {
        valorAcordado = paraCentavos(b.valor as string);
      } catch {
        return erro(400, "Valor inválido.");
      }
    }

    transacao(() => {
      if (haConflito(Number(row.consultorio_id), data, inicio, { reservaId: Number(id) })) {
        throw new ConflitoError("O novo horário informado está ocupado (RF-039).");
      }
      db.prepare(
        `UPDATE reservas SET profissional_id = ?, data = ?, inicio = ?, fim = ?,
         valor_acordado = ?, observacoes = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(profissionalId, data, inicio, inicio + 1, valorAcordado, (b.observacoes ?? String(row.observacoes ?? "")).trim() || null, Number(id));
      // Valor acordado editado também atualiza o lançamento vinculado (se existir e ainda não houver pagamento)
      if (b.valor !== undefined) {
        const lanc = db
          .prepare("SELECT id FROM lancamentos WHERE reserva_id = ?")
          .get(Number(id)) as { id: number } | undefined;
        if (lanc && valorAcordado && valorAcordado > 0) {
          const pago = db
            .prepare("SELECT COALESCE(SUM(valor),0) AS t FROM pagamentos WHERE lancamento_id = ?")
            .get(lanc.id) as { t: number };
          if (Number(pago.t) === 0) {
            db.prepare("UPDATE lancamentos SET valor_cobrado = ?, updated_at = datetime('now') WHERE id = ?").run(
              valorAcordado,
              lanc.id
            );
          }
        }
      }
    });

    registrarAuditoria(
      sessao.adminId,
      "editar",
      "reserva",
      Number(id),
      `Reserva reagendada para ${data} às ${String(inicio).padStart(2, "0")}h.`
    );
    return ok({ ok: true });
  } catch (e) {
    return tratarErro(e);
  }
}

/**
 * DELETE /api/admin/reservas/[id] — cancela preservando o histórico (RF-054 / 5.4).
 * Cancela somente esta ocorrência pontual.
 */
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  try {
    const sessao = await exigirSessao();
    const { id } = await params;
    const db = getDb();
    const atual = db.prepare("SELECT * FROM reservas WHERE id = ?").get(Number(id));
    if (!atual) return erro(404, "Reserva não encontrada.");
    const row = atual as unknown as Record<string, unknown>;
    if (row.situacao === "cancelada") return erro(409, "Esta reserva já está cancelada.");

    db.prepare(
      "UPDATE reservas SET situacao = 'cancelada', updated_at = datetime('now') WHERE id = ?"
    ).run(Number(id));

    // Lançamento vinculado sem pagamento também é cancelado; com pagamento, permanece para conferência
    const lanc = db.prepare("SELECT id FROM lancamentos WHERE reserva_id = ?").get(Number(id)) as
      | { id: number }
      | undefined;
    if (lanc) {
      const pago = db
        .prepare("SELECT COALESCE(SUM(valor),0) AS t FROM pagamentos WHERE lancamento_id = ?")
        .get(lanc.id) as { t: number };
      if (Number(pago.t) === 0) {
        db.prepare("UPDATE lancamentos SET situacao = 'cancelado', updated_at = datetime('now') WHERE id = ?").run(
          lanc.id
        );
      }
    }

    registrarAuditoria(
      sessao.adminId,
      "cancelar",
      "reserva",
      Number(id),
      `Cancelou reserva ${row.tipo} de ${row.data} às ${String(row.inicio).padStart(2, "0")}h (histórico preservado).`
    );
    return ok({ ok: true });
  } catch (e) {
    return tratarErro(e);
  }
}
