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

const PESQUISA_SOURCES = [
  "dap", "caf", "incra", "cnis", "ctps", "tribunal", "provas", "receita", "detran", "jusbrasil", "inss",
  "sncr", "sigef", "registro_rural", "pesqbrasil", "sisrgp", "cnd_to", "contag",
  "pje_trf1", "trf1_secao_to", "trf1_araguaina", "trf1_balsas", "trf1_imperatriz", "trf1_palmas", "trf1_gurupi",
  "tse_local_votacao", "tse_certidao"
] as const;

for (const source of PESQUISA_SOURCES) {
  router.get(`/pesquisa-cpf/${source}/:cpf`, async (req, res) => {
    const cpfRaw = req.params.cpf.replace(/\D/g, "");
    const label = source.toUpperCase().replace(/_/g, " ");
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

router.post("/pesquisa/gerar-pdf", async (req, res) => {
  try {
    const PDFDocument = (await import("pdfkit")).default;
    const { cpf, dataNascimento, nomeMae, nomePai, local, mensagem, dados } = req.body as {
      cpf: string;
      dataNascimento?: string;
      nomeMae?: string;
      nomePai?: string;
      local: string;
      mensagem: string;
      dados?: Record<string, unknown>;
    };

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    await new Promise<void>((resolve, reject) => {
      doc.on("end", resolve);
      doc.on("error", reject);

      doc.fontSize(18).font("Helvetica-Bold").text("Relatório de Pesquisa", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica").text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, { align: "center" });
      doc.moveDown(1);

      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(12).font("Helvetica-Bold").text("Dados da Pesquisa:");
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica");
      doc.text(`CPF: ${cpf}`);
      if (dataNascimento) doc.text(`Data Nascimento: ${dataNascimento}`);
      if (nomeMae) doc.text(`Nome da Mãe: ${nomeMae}`);
      if (nomePai) doc.text(`Nome do Pai: ${nomePai}`);
      doc.moveDown(0.5);

      doc.fontSize(12).font("Helvetica-Bold").text(`Fonte: ${local}`);
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica").text(`Resultado: ${mensagem}`);
      doc.moveDown(0.5);

      if (dados && typeof dados === "object" && Object.keys(dados).length > 0) {
        doc.fontSize(12).font("Helvetica-Bold").text("Dados Retornados:");
        doc.moveDown(0.3);
        doc.fontSize(9).font("Helvetica");

        function printObj(obj: unknown, indent: number = 0) {
          if (typeof obj !== "object" || obj === null) {
            doc.text(String(obj), { indent: indent * 15 });
            return;
          }
          if (Array.isArray(obj)) {
            obj.forEach((item, idx) => {
              doc.text(`[${idx + 1}]`, { indent: indent * 15 });
              printObj(item, indent + 1);
            });
          } else {
            for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
              if (typeof val === "object" && val !== null) {
                doc.text(`${key}:`, { indent: indent * 15 });
                printObj(val, indent + 1);
              } else {
                doc.text(`${key}: ${val ?? ""}`, { indent: indent * 15 });
              }
            }
          }
        }
        printObj(dados);
      }

      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(8).font("Helvetica").fillColor("#888888")
        .text("Documento gerado automaticamente pelo sistema Promarcos - Mendes Advocacia", { align: "center" });

      doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);
    const safeLocal = local.replace(/[^a-zA-Z0-9]/g, "_");
    const safeCpf = cpf.replace(/\D/g, "");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="pesquisa_${safeLocal}_${safeCpf}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro ao gerar PDF" });
  }
});

export default router;
