import { Router, type IRouter } from "express";
import { db, clientesTable, processosTable, anexosTable } from "@workspace/db";
import { eq, or, ilike, sql } from "drizzle-orm";
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
    if (!cliente) { res.status(404).json({ error: "Cliente não encontrado" }); return; }
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
    if (!cliente) { res.status(404).json({ error: "Cliente não encontrado" }); return; }
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
    if (!processo) { res.status(404).json({ error: "Processo não encontrado" }); return; }
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

const PROMARCOS_BASE = "https://api.onprise.com.br/api";

async function fetchWithTimeout(url: string, timeoutMs = 30000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

router.get("/pesquisa-cpf/local/:cpf", async (req, res) => {
  try {
    const cpfRaw = req.params.cpf.replace(/\D/g, "");
    if (cpfRaw.length !== 11) {
      res.json({ local: "Sistema Local", encontrado: false, mensagem: "CPF inválido" });
      return;
    }
    const clientes = await db
      .select()
      .from(clientesTable)
      .where(sql`REPLACE(REPLACE(REPLACE(${clientesTable.cpf}, '.', ''), '-', ''), ' ', '') = ${cpfRaw}`);

    if (clientes.length > 0) {
      const detalhes = clientes.map((c) => ({
        nome: c.nomeCompleto,
        cpf: c.cpf,
        escritorio: c.escritorio || "",
        telefone: c.telefone || "",
        telefone2: c.telefone2 || "",
        email: c.email || "",
        cidade: c.cidade || "",
        estado: c.estado || "",
        logradouro: c.logradouro || "",
        numero: c.numero || "",
        bairro: c.bairro || "",
      }));
      res.json({ local: "Sistema Local", encontrado: true, mensagem: "Dados encontrados para esta consulta", detalhes });
    } else {
      res.json({ local: "Sistema Local", encontrado: false, mensagem: "Nenhum dado encontrado para esta consulta" });
    }
  } catch (err) {
    req.log.error(err);
    res.json({ local: "Sistema Local", encontrado: false, mensagem: "Erro ao consultar sistema local" });
  }
});

router.get("/pesquisa-cpf/promarcos/:cpf", async (req, res) => {
  try {
    const cpfRaw = req.params.cpf.replace(/\D/g, "");
    const upstream = await fetchWithTimeout(`${PROMARCOS_BASE}/pessoas/buscarcpf/${cpfRaw}`);
    if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
    const data = await upstream.json() as { existe?: boolean; pessoas?: Record<string, unknown>[] };
    if (data.existe && Array.isArray(data.pessoas) && data.pessoas.length > 0) {
      const detalhes = data.pessoas.map((p: Record<string, unknown>) => ({
        nome: p.razao_social,
        codigo: p.codigo,
        cpf: p.cpf,
        nascimento: p.nascimento,
        telefone1: p.telefone1 || "",
        telefone2: p.telefone2 || "",
        email: p.email1 || "",
        profissao: p.profissao || "",
        cidade: p.cidade || "",
        estado: p.estado || "",
      }));
      res.json({ local: "Promarcos", encontrado: true, mensagem: "Dados encontrados para esta consulta", detalhes });
    } else {
      res.json({ local: "Promarcos", encontrado: false, mensagem: "Nenhum dado encontrado para esta consulta" });
    }
  } catch {
    res.json({ local: "Promarcos", encontrado: false, mensagem: "Erro ao consultar Promarcos" });
  }
});

const PESQUISA_SOURCES = ["dap", "caf", "incra", "cnis", "ctps", "tribunal", "provas", "receita", "detran", "jusbrasil", "inss", "sncr", "sigef", "registro_rural", "pesqbrasil", "sisrgp", "cnd_to", "contag", "pje_trf1", "trf1_secao_to"] as const;

for (const source of PESQUISA_SOURCES) {
  router.get(`/pesquisa-cpf/${source}/:cpf`, async (req, res) => {
    const cpfRaw = req.params.cpf.replace(/\D/g, "");
    const label = source.toUpperCase();
    try {
      const upstream = await fetchWithTimeout(`${PROMARCOS_BASE}/pesquisa/${source}/${cpfRaw}`, 30000);
      if (!upstream.ok) {
        const contentType = upstream.headers.get("content-type") || "";
        if (contentType.includes("json")) {
          const data = await upstream.json() as Record<string, unknown>;
          const found = data && ((data as Record<string, unknown>).encontrado === true || (data as Record<string, unknown>).existe === true || (Array.isArray(data) && data.length > 0));
          res.json({ local: label, encontrado: !!found, mensagem: found ? "Dados encontrados para esta consulta" : "Nenhum dado encontrado para esta consulta", dados: data });
        } else {
          res.json({ local: label, encontrado: false, mensagem: "Nenhum dado encontrado para esta consulta" });
        }
        return;
      }
      const data = await upstream.json() as Record<string, unknown>;
      const found = data && ((data as Record<string, unknown>).encontrado === true || (data as Record<string, unknown>).existe === true || (Array.isArray(data) && data.length > 0) || (typeof data === "object" && Object.keys(data).length > 0));
      res.json({ local: label, encontrado: !!found, mensagem: found ? "Dados encontrados para esta consulta" : "Nenhum dado encontrado para esta consulta", dados: data });
    } catch {
      res.json({ local: label, encontrado: false, mensagem: "Serviço temporariamente indisponível" });
    }
  });
}

export default router;
