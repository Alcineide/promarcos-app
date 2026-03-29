import { Router, type IRouter } from "express";
import { db, usuariosTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const SUPER_ADMIN_EMAIL = "marcosaurelio_adv@outlook.com";
const VALID_ROLES = ["admin", "user"] as const;

const router: IRouter = Router();

async function ensureSuperAdmin() {
  const [existing] = await db
    .select()
    .from(usuariosTable)
    .where(eq(usuariosTable.email, SUPER_ADMIN_EMAIL));
  if (!existing) {
    await db.insert(usuariosTable).values({
      email: SUPER_ADMIN_EMAIL,
      nome: "MARCOS AURÉLIO",
      role: "admin",
      isSuperAdmin: true,
      ativo: true,
    });
  } else if (!existing.isSuperAdmin || existing.role !== "admin") {
    await db
      .update(usuariosTable)
      .set({ isSuperAdmin: true, role: "admin", ativo: true })
      .where(eq(usuariosTable.id, existing.id));
  }
}

ensureSuperAdmin().catch(console.error);

router.get("/usuarios/me", async (req, res) => {
  try {
    const email = req.headers["x-user-email"] as string;
    if (!email) {
      res.json({ role: "user", isSuperAdmin: false });
      return;
    }
    const [usuario] = await db
      .select()
      .from(usuariosTable)
      .where(eq(usuariosTable.email, email.toLowerCase()));
    if (!usuario) {
      res.json({ role: "user", isSuperAdmin: false, ativo: true });
      return;
    }
    res.json({
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      role: usuario.role,
      isSuperAdmin: usuario.isSuperAdmin,
      ativo: usuario.ativo,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/usuarios", async (req, res) => {
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
    const usuarios = await db
      .select()
      .from(usuariosTable)
      .orderBy(usuariosTable.nome);
    res.json(
      usuarios.map((u) => ({
        id: u.id,
        email: u.email,
        nome: u.nome,
        role: u.role,
        isSuperAdmin: u.isSuperAdmin,
        ativo: u.ativo,
        createdAt: u.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/usuarios", async (req, res) => {
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

    const { email, nome, role } = req.body as {
      email: string;
      nome: string;
      role: string;
    };
    if (!email || !nome) {
      res.status(400).json({ error: "Email e nome são obrigatórios" });
      return;
    }
    const safeRole = VALID_ROLES.includes(role as typeof VALID_ROLES[number]) ? role : "user";
    if (safeRole === "admin" && !requester.isSuperAdmin) {
      res.status(403).json({
        error: "Apenas o super administrador pode promover outros a administrador",
      });
      return;
    }

    const [existing] = await db
      .select()
      .from(usuariosTable)
      .where(eq(usuariosTable.email, email.toLowerCase()));
    if (existing) {
      res.status(409).json({ error: "Usuário já cadastrado" });
      return;
    }

    const [usuario] = await db
      .insert(usuariosTable)
      .values({
        email: email.toLowerCase(),
        nome,
        role: safeRole,
        isSuperAdmin: false,
        ativo: true,
      })
      .returning();

    res.status(201).json({
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      role: usuario.role,
      isSuperAdmin: usuario.isSuperAdmin,
      ativo: usuario.ativo,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.put("/usuarios/:id", async (req, res) => {
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
    const { nome, role, ativo } = req.body as {
      nome?: string;
      role?: string;
      ativo?: boolean;
    };

    const [target] = await db
      .select()
      .from(usuariosTable)
      .where(eq(usuariosTable.id, id));
    if (!target) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }
    if (target.isSuperAdmin) {
      res.status(403).json({ error: "O super administrador não pode ser alterado" });
      return;
    }
    const safeRole = role !== undefined
      ? (VALID_ROLES.includes(role as typeof VALID_ROLES[number]) ? role : undefined)
      : undefined;
    if (safeRole === "admin" && !requester.isSuperAdmin) {
      res.status(403).json({
        error: "Apenas o super administrador pode promover outros a administrador",
      });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (nome !== undefined) updates.nome = nome;
    if (safeRole !== undefined) updates.role = safeRole;
    if (ativo !== undefined) updates.ativo = ativo;

    const [updated] = await db
      .update(usuariosTable)
      .set(updates)
      .where(eq(usuariosTable.id, id))
      .returning();

    res.json({
      id: updated.id,
      email: updated.email,
      nome: updated.nome,
      role: updated.role,
      isSuperAdmin: updated.isSuperAdmin,
      ativo: updated.ativo,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/usuarios/:id", async (req, res) => {
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
    if (!requester || !requester.ativo) {
      res.status(401).json({ error: "Não autenticado" });
      return;
    }

    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const [target] = await db
      .select()
      .from(usuariosTable)
      .where(eq(usuariosTable.id, id));
    if (!target) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }
    if (target.isSuperAdmin) {
      res.status(403).json({ error: "O super administrador não pode ser removido" });
      return;
    }

    const isAdmin = requester.role === "admin" || requester.isSuperAdmin;
    if (!isAdmin) {
      res.status(403).json({ error: "Apenas administradores podem remover usuários" });
      return;
    }

    if (target.ativo && !requester.isSuperAdmin) {
      res.status(403).json({ error: "Apenas o super administrador pode remover usuários ativos" });
      return;
    }

    await db.delete(usuariosTable).where(eq(usuariosTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
