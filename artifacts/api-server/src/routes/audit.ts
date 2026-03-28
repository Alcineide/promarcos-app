import { Router, type IRouter } from "express";
import { db, auditLogTable, tipoAcaoValues } from "@workspace/db";
import type { TipoAcao } from "@workspace/db";
import { eq, and, gte, lte, ilike } from "drizzle-orm";

const AUDIT_ADMIN_KEY = process.env.AUDIT_ADMIN_KEY || "";

const router: IRouter = Router();

function isValidTipoAcao(v: string): v is TipoAcao {
  return (tipoAcaoValues as readonly string[]).includes(v);
}

function safeInt(v: string | undefined, fallback: number): number {
  const n = parseInt(v || String(fallback), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

router.post("/audit/sync", async (req, res) => {
  const syncKey = req.headers["x-audit-sync-key"] as string | undefined;
  if (!process.env.AUDIT_SYNC_KEY || syncKey !== process.env.AUDIT_SYNC_KEY) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  try {
    const { registros } = req.body as {
      registros: Array<{
        colaborador_email: string;
        colaborador_codigo?: number;
        cpf_consultado?: string;
        tipo_acao: string;
        havia_cadastro?: string;
        campos_alterados?: unknown;
        termo_buscado?: string;
        latitude?: string;
        longitude?: string;
        data_hora: string;
        device_id?: string;
      }>;
    };

    if (!Array.isArray(registros) || registros.length === 0) {
      res.status(400).json({ error: "Nenhum registro enviado" });
      return;
    }

    const validated = [];
    for (const r of registros) {
      if (!r.colaborador_email || !r.tipo_acao || !r.data_hora) continue;
      if (!isValidTipoAcao(r.tipo_acao)) continue;
      const parsedDate = new Date(r.data_hora);
      if (isNaN(parsedDate.getTime())) continue;

      validated.push({
        colaboradorEmail: r.colaborador_email,
        colaboradorCodigo: r.colaborador_codigo ?? null,
        cpfConsultado: r.cpf_consultado ?? null,
        tipoAcao: r.tipo_acao as TipoAcao,
        haviacadastro: r.havia_cadastro ?? null,
        camposAlterados: r.campos_alterados ?? null,
        termoBuscado: r.termo_buscado ?? null,
        latitude: r.latitude ?? null,
        longitude: r.longitude ?? null,
        dataHora: parsedDate,
        deviceId: r.device_id ?? null,
        syncStatus: "synced" as const,
        syncedAt: new Date(),
      });
    }

    if (validated.length === 0) {
      res.status(400).json({ error: "Nenhum registro válido" });
      return;
    }

    await db.insert(auditLogTable).values(validated);

    res.json({ success: true, count: validated.length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro ao sincronizar registros de auditoria" });
  }
});

router.get("/audit/logs", async (req, res) => {
  const authHeader = req.headers["x-audit-key"] as string | undefined;
  if (!AUDIT_ADMIN_KEY || authHeader !== AUDIT_ADMIN_KEY) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  try {
    const {
      colaborador,
      cpf,
      tipo,
      de,
      ate,
      limit: limitStr,
      offset: offsetStr,
    } = req.query as Record<string, string | undefined>;

    const conditions = [];

    if (colaborador) {
      conditions.push(ilike(auditLogTable.colaboradorEmail, `%${colaborador}%`));
    }
    if (cpf) {
      conditions.push(ilike(auditLogTable.cpfConsultado, `%${cpf}%`));
    }
    if (tipo && isValidTipoAcao(tipo)) {
      conditions.push(eq(auditLogTable.tipoAcao, tipo));
    }
    if (de) {
      const deDate = new Date(de);
      if (!isNaN(deDate.getTime())) {
        conditions.push(gte(auditLogTable.dataHora, deDate));
      }
    }
    if (ate) {
      const ateDate = new Date(ate);
      if (!isNaN(ateDate.getTime())) {
        conditions.push(lte(auditLogTable.dataHora, ateDate));
      }
    }

    const limit = Math.min(safeInt(limitStr, 100), 500);
    const offset = safeInt(offsetStr, 0);

    let query = db
      .select()
      .from(auditLogTable)
      .orderBy(auditLogTable.dataHora)
      .limit(limit)
      .offset(offset);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const logs = await query;

    res.json(
      logs.map((l) => ({
        ...l,
        dataHora: l.dataHora.toISOString(),
        syncedAt: l.syncedAt?.toISOString() ?? null,
      }))
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro ao consultar logs de auditoria" });
  }
});

export default router;
