import { Router, type IRouter } from "express";
import { db, clientesTable, processosTable, anexosTable } from "@workspace/db";
import { eq, or, ilike } from "drizzle-orm";
import {
  CreateClienteBody,
  GetClienteParams,
  UpdateClienteParams,
  UpdateClienteBody,
  ListClientesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/clientes", async (req, res) => {
  try {
    const query = ListClientesQueryParams.parse(req.query);
    let clientes;
    if (query.search) {
      const term = `%${query.search}%`;
      clientes = await db
        .select()
        .from(clientesTable)
        .where(or(ilike(clientesTable.cpf, term), ilike(clientesTable.nomeCompleto, term)));
    } else {
      clientes = await db.select().from(clientesTable).orderBy(clientesTable.nomeCompleto);
    }
    res.json(
      clientes.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/clientes", async (req, res) => {
  try {
    const body = CreateClienteBody.parse(req.body);
    const [cliente] = await db.insert(clientesTable).values(body).returning();
    res.status(201).json({
      ...cliente,
      createdAt: cliente.createdAt.toISOString(),
      updatedAt: cliente.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
  }
});

router.get("/clientes/:id", async (req, res) => {
  try {
    const { id } = GetClienteParams.parse({ id: Number(req.params.id) });
    const [cliente] = await db.select().from(clientesTable).where(eq(clientesTable.id, id));
    if (!cliente) return res.status(404).json({ error: "Cliente não encontrado" });
    res.json({
      ...cliente,
      createdAt: cliente.createdAt.toISOString(),
      updatedAt: cliente.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.put("/clientes/:id", async (req, res) => {
  try {
    const { id } = UpdateClienteParams.parse({ id: Number(req.params.id) });
    const body = UpdateClienteBody.parse(req.body);
    const [cliente] = await db
      .update(clientesTable)
      .set(body)
      .where(eq(clientesTable.id, id))
      .returning();
    if (!cliente) return res.status(404).json({ error: "Cliente não encontrado" });
    res.json({
      ...cliente,
      createdAt: cliente.createdAt.toISOString(),
      updatedAt: cliente.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
  }
});

router.get("/clientes/:id/processos", async (req, res) => {
  try {
    const clienteId = Number(req.params.id);
    const processos = await db
      .select()
      .from(processosTable)
      .where(eq(processosTable.clienteId, clienteId));
    res.json(
      processos.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/clientes/:id/processos", async (req, res) => {
  try {
    const clienteId = Number(req.params.id);
    const body = { ...req.body, clienteId };
    if (body.urgencia !== undefined) body.urgencia = Boolean(body.urgencia);
    const [processo] = await db
      .insert(processosTable)
      .values(body)
      .returning();
    res.status(201).json({
      ...processo,
      createdAt: processo.createdAt.toISOString(),
      updatedAt: processo.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
  }
});

router.put("/processos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [processo] = await db
      .update(processosTable)
      .set(req.body)
      .where(eq(processosTable.id, id))
      .returning();
    if (!processo) return res.status(404).json({ error: "Processo não encontrado" });
    res.json({
      ...processo,
      createdAt: processo.createdAt.toISOString(),
      updatedAt: processo.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
  }
});

router.get("/clientes/:id/anexos", async (req, res) => {
  try {
    const clienteId = Number(req.params.id);
    const anexos = await db
      .select()
      .from(anexosTable)
      .where(eq(anexosTable.clienteId, clienteId));
    res.json(
      anexos.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/clientes/:id/anexos", async (req, res) => {
  try {
    const clienteId = Number(req.params.id);
    const [anexo] = await db
      .insert(anexosTable)
      .values({ ...req.body, clienteId })
      .returning();
    res.status(201).json({
      ...anexo,
      createdAt: anexo.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Dados inválidos" });
  }
});

router.delete("/anexos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(anexosTable).where(eq(anexosTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
