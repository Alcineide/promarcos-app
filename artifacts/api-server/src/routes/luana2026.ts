import { Router, type IRouter } from "express";
import { db, usuariosTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const LUANA_API = "https://luana-2026.replit.app";
const SUPER_ADMIN_EMAIL = "marcosaurelio_adv@outlook.com";
const LUANA_ADMIN_PASSWORD = "#Luana2026";

const router: IRouter = Router();

async function getLuanaToken(): Promise<string | null> {
  try {
    const res = await fetch(`${LUANA_API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: SUPER_ADMIN_EMAIL, senha: LUANA_ADMIN_PASSWORD }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { token?: string };
    return data.token || null;
  } catch {
    return null;
  }
}

async function requireAdmin(email: string): Promise<boolean> {
  const [requester] = await db
    .select()
    .from(usuariosTable)
    .where(eq(usuariosTable.email, email.toLowerCase()));
  return !!(requester && requester.ativo && (requester.role === "admin" || requester.isSuperAdmin));
}

router.get("/luana2026/dispositivos", async (req, res) => {
  try {
    const requesterEmail = req.headers["x-user-email"] as string;
    if (!requesterEmail || !(await requireAdmin(requesterEmail))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const token = await getLuanaToken();
    if (!token) {
      res.status(502).json({ error: "Não foi possível conectar ao Luana 2026" });
      return;
    }

    const luanaRes = await fetch(`${LUANA_API}/api/admin/dispositivos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!luanaRes.ok) {
      res.status(502).json({ error: "Erro ao buscar dispositivos do Luana 2026" });
      return;
    }

    const dispositivos = await luanaRes.json();
    res.json(dispositivos);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.put("/luana2026/dispositivos/:id", async (req, res) => {
  try {
    const requesterEmail = req.headers["x-user-email"] as string;
    if (!requesterEmail || !(await requireAdmin(requesterEmail))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const token = await getLuanaToken();
    if (!token) {
      res.status(502).json({ error: "Não foi possível conectar ao Luana 2026" });
      return;
    }

    const { status, device_label } = req.body as { status: string; device_label?: string };
    const luanaRes = await fetch(`${LUANA_API}/api/admin/dispositivos/${req.params.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status, device_label: device_label || "" }),
    });

    if (!luanaRes.ok) {
      res.status(502).json({ error: "Erro ao atualizar dispositivo no Luana 2026" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/luana2026/dispositivos/:id", async (req, res) => {
  try {
    const requesterEmail = req.headers["x-user-email"] as string;
    if (!requesterEmail || !(await requireAdmin(requesterEmail))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const token = await getLuanaToken();
    if (!token) {
      res.status(502).json({ error: "Não foi possível conectar ao Luana 2026" });
      return;
    }

    const luanaRes = await fetch(`${LUANA_API}/api/admin/dispositivos/${req.params.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!luanaRes.ok) {
      res.status(502).json({ error: "Erro ao remover dispositivo no Luana 2026" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/luana2026/usuarios", async (req, res) => {
  try {
    const requesterEmail = req.headers["x-user-email"] as string;
    if (!requesterEmail || !(await requireAdmin(requesterEmail))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const token = await getLuanaToken();
    if (!token) {
      res.status(502).json({ error: "Não foi possível conectar ao Luana 2026" });
      return;
    }

    const luanaRes = await fetch(`${LUANA_API}/api/admin/usuarios`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!luanaRes.ok) {
      res.status(502).json({ error: "Erro ao buscar usuários do Luana 2026" });
      return;
    }

    const usuarios = await luanaRes.json();
    res.json(usuarios);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/luana2026/usuarios", async (req, res) => {
  try {
    const requesterEmail = req.headers["x-user-email"] as string;
    if (!requesterEmail || !(await requireAdmin(requesterEmail))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const token = await getLuanaToken();
    if (!token) {
      res.status(502).json({ error: "Não foi possível conectar ao Luana 2026" });
      return;
    }

    const luanaRes = await fetch(`${LUANA_API}/api/admin/usuarios`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(req.body),
    });

    const data = await luanaRes.json();
    if (!luanaRes.ok) {
      res.status(luanaRes.status).json(data);
      return;
    }

    res.json(data);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.put("/luana2026/usuarios/:id", async (req, res) => {
  try {
    const requesterEmail = req.headers["x-user-email"] as string;
    if (!requesterEmail || !(await requireAdmin(requesterEmail))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const token = await getLuanaToken();
    if (!token) {
      res.status(502).json({ error: "Não foi possível conectar ao Luana 2026" });
      return;
    }

    const luanaRes = await fetch(`${LUANA_API}/api/admin/usuarios/${req.params.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(req.body),
    });

    const data = await luanaRes.json();
    if (!luanaRes.ok) {
      res.status(luanaRes.status).json(data);
      return;
    }

    res.json(data);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/luana2026/usuarios/:id", async (req, res) => {
  try {
    const requesterEmail = req.headers["x-user-email"] as string;
    if (!requesterEmail || !(await requireAdmin(requesterEmail))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const token = await getLuanaToken();
    if (!token) {
      res.status(502).json({ error: "Não foi possível conectar ao Luana 2026" });
      return;
    }

    const luanaRes = await fetch(`${LUANA_API}/api/admin/usuarios/${req.params.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!luanaRes.ok) {
      res.status(502).json({ error: "Erro ao remover usuário do Luana 2026" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
