import { Router, type IRouter } from "express";
import { db, deviceSessionsTable, usuariosTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const MAX_DEVICES = 2;

const router: IRouter = Router();

router.post("/auth/check-device", async (req, res) => {
  try {
    const { email, deviceId, deviceName } = req.body as {
      email: string;
      deviceId: string;
      deviceName?: string;
    };

    if (!email || !deviceId) {
      res.status(400).json({ error: "Email e deviceId são obrigatórios" });
      return;
    }

    const emailLower = email.toLowerCase();

    const [existingDevice] = await db
      .select()
      .from(deviceSessionsTable)
      .where(
        and(
          eq(deviceSessionsTable.userEmail, emailLower),
          eq(deviceSessionsTable.deviceId, deviceId),
          eq(deviceSessionsTable.ativo, true)
        )
      );

    if (existingDevice) {
      await db
        .update(deviceSessionsTable)
        .set({
          lastSeenAt: new Date(),
          deviceName: deviceName || existingDevice.deviceName,
        })
        .where(eq(deviceSessionsTable.id, existingDevice.id));

      res.json({ allowed: true, deviceName: deviceName || existingDevice.deviceName });
      return;
    }

    const activeSessions = await db
      .select()
      .from(deviceSessionsTable)
      .where(
        and(
          eq(deviceSessionsTable.userEmail, emailLower),
          eq(deviceSessionsTable.ativo, true)
        )
      )
      .orderBy(desc(deviceSessionsTable.lastSeenAt));

    if (activeSessions.length >= MAX_DEVICES) {
      res.status(403).json({
        error: `Limite de ${MAX_DEVICES} dispositivos atingido. Desautorize um dispositivo antes de usar outro.`,
        allowed: false,
        activeDevices: activeSessions.map((s) => ({
          id: s.id,
          deviceName: s.deviceName || "Dispositivo desconhecido",
          lastSeenAt: s.lastSeenAt.toISOString(),
        })),
      });
      return;
    }

    const [newSession] = await db
      .insert(deviceSessionsTable)
      .values({
        userEmail: emailLower,
        deviceId,
        deviceName: deviceName || null,
        lastSeenAt: new Date(),
      })
      .returning();

    res.json({
      allowed: true,
      deviceName: newSession.deviceName,
      sessionId: newSession.id,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/auth/devices/:email", async (req, res) => {
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

    const email = decodeURIComponent(req.params.email).toLowerCase();
    const sessions = await db
      .select()
      .from(deviceSessionsTable)
      .where(
        and(
          eq(deviceSessionsTable.userEmail, email),
          eq(deviceSessionsTable.ativo, true)
        )
      )
      .orderBy(desc(deviceSessionsTable.lastSeenAt));

    res.json(
      sessions.map((s) => ({
        id: s.id,
        deviceId: s.deviceId,
        deviceName: s.deviceName,
        lastSeenAt: s.lastSeenAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/auth/devices/:id", async (req, res) => {
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

    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    await db
      .update(deviceSessionsTable)
      .set({ ativo: false })
      .where(eq(deviceSessionsTable.id, id));

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
