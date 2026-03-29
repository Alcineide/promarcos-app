import { Router, type IRouter } from "express";
import { db, auditLogTable, tipoAcaoValues, usuariosTable } from "@workspace/db";
import type { TipoAcao } from "@workspace/db";
import { eq, and, gte, lte, ilike, desc, sql } from "drizzle-orm";

const AUDIT_ADMIN_KEY = process.env.AUDIT_ADMIN_KEY || "";

const router: IRouter = Router();

function isValidTipoAcao(v: string): v is TipoAcao {
  return (tipoAcaoValues as readonly string[]).includes(v);
}

function safeInt(v: string | undefined, fallback: number): number {
  const n = parseInt(v || String(fallback), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

router.post("/audit/log", async (req, res) => {
  try {
    const userEmail = req.headers["x-user-email"] as string | undefined;
    if (!userEmail) {
      res.status(401).json({ error: "Não autenticado" });
      return;
    }

    const { tipo_acao, cpf_consultado, havia_cadastro, campos_alterados, termo_buscado, latitude, longitude, device_id } = req.body as {
      tipo_acao: string;
      cpf_consultado?: string;
      havia_cadastro?: string;
      campos_alterados?: unknown;
      termo_buscado?: string;
      latitude?: string;
      longitude?: string;
      device_id?: string;
    };

    if (!tipo_acao || !isValidTipoAcao(tipo_acao)) {
      res.status(400).json({ error: "Tipo de ação inválido" });
      return;
    }

    await db.insert(auditLogTable).values({
      colaboradorEmail: userEmail.toLowerCase(),
      cpfConsultado: cpf_consultado ?? null,
      tipoAcao: tipo_acao as TipoAcao,
      haviacadastro: havia_cadastro ?? null,
      camposAlterados: campos_alterados ?? null,
      termoBuscado: termo_buscado ?? null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      dataHora: new Date(),
      deviceId: device_id ?? null,
      syncStatus: "synced",
      syncedAt: new Date(),
    });

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro ao registrar auditoria" });
  }
});

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

router.get("/audit/admin-logs", async (req, res) => {
  try {
    const requesterEmail = req.headers["x-user-email"] as string;
    if (!requesterEmail) {
      res.status(401).json({ error: "Não autenticado" });
      return;
    }
    const [requester] = await db
      .select()
      .from(usuariosTable)
      .where(eq(usuariosTable.email, requesterEmail.toLowerCase()));
    if (!requester || requester.role !== "admin" || !requester.ativo) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

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
        ateDate.setHours(23, 59, 59, 999);
        conditions.push(lte(auditLogTable.dataHora, ateDate));
      }
    }

    const limit = Math.min(safeInt(limitStr, 50), 200);
    const offset = safeInt(offsetStr, 0);

    let query = db
      .select()
      .from(auditLogTable)
      .orderBy(desc(auditLogTable.dataHora))
      .limit(limit)
      .offset(offset);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const logs = await query;

    const countQuery = conditions.length > 0
      ? db.select({ count: sql<number>`count(*)` }).from(auditLogTable).where(and(...conditions))
      : db.select({ count: sql<number>`count(*)` }).from(auditLogTable);
    const [{ count }] = await countQuery;

    res.json({
      logs: logs.map((l) => ({
        id: l.id,
        colaboradorEmail: l.colaboradorEmail,
        colaboradorCodigo: l.colaboradorCodigo,
        cpfConsultado: l.cpfConsultado,
        tipoAcao: l.tipoAcao,
        haviacadastro: l.haviacadastro,
        camposAlterados: l.camposAlterados,
        termoBuscado: l.termoBuscado,
        latitude: l.latitude,
        longitude: l.longitude,
        dataHora: l.dataHora.toISOString(),
        deviceId: l.deviceId,
        syncedAt: l.syncedAt?.toISOString() ?? null,
      })),
      total: Number(count),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro ao consultar logs de auditoria" });
  }
});

export default router;
