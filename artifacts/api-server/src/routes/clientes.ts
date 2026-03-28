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

router.get("/pesquisa-cpf/:cpf", async (req, res) => {
  try {
    const cpfRaw = req.params.cpf.replace(/\D/g, "");
    if (cpfRaw.length !== 11) {
      res.status(400).json({ error: "CPF inválido" });
      return;
    }

    const results: { local: string; mensagem: string }[] = [];

    const localPromise = db
      .select()
      .from(clientesTable)
      .where(sql`REPLACE(REPLACE(REPLACE(${clientesTable.cpf}, '.', ''), '-', ''), ' ', '') = ${cpfRaw}`)
      .then((clientes) => {
        if (clientes.length > 0) {
          for (const c of clientes) {
            const escritorioInfo = c.escritorio ? ` | Escritório: ${c.escritorio}` : "";
            results.push({
              local: "Sistema Local",
              mensagem: `Encontrado: ${c.nomeCompleto} (CPF: ${c.cpf})${escritorioInfo}`,
            });
            if (c.telefone) {
              results.push({
                local: "Sistema Local",
                mensagem: `Telefone: ${c.telefone}${c.telefone2 ? ` / ${c.telefone2}` : ""}`,
              });
            }
            if (c.email) {
              results.push({
                local: "Sistema Local",
                mensagem: `E-mail: ${c.email}`,
              });
            }
            if (c.cidade && c.estado) {
              results.push({
                local: "Sistema Local",
                mensagem: `Endereço: ${c.logradouro || ""} ${c.numero || ""}, ${c.bairro || ""} - ${c.cidade}/${c.estado}`,
              });
            }
          }
        } else {
          results.push({
            local: "Sistema Local",
            mensagem: "CPF não encontrado no sistema local",
          });
        }
      })
      .catch(() => {
        results.push({
          local: "Sistema Local",
          mensagem: "Erro ao consultar sistema local",
        });
      });

    const promarkosPromise = (async () => {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 15000);
      try {
        const upstream = await fetch(`${PROMARCOS_BASE}/pessoas/buscarcpf/${cpfRaw}`, { signal: ctrl.signal });
        clearTimeout(timeout);
        if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
        const data = await upstream.json();
        if (data.existe && Array.isArray(data.pessoas) && data.pessoas.length > 0) {
          for (const p of data.pessoas) {
            const nascimento = p.nascimento
              ? ` | Nasc: ${new Date(p.nascimento).toLocaleDateString("pt-BR")}`
              : "";
            const cidade = p.cidade && p.estado ? ` | ${p.cidade}/${p.estado}` : "";
            results.push({
              local: "Promarcos",
              mensagem: `Encontrado: ${p.razao_social} (Cód: ${p.codigo})${nascimento}${cidade}`,
            });
            if (p.telefone1) {
              results.push({
                local: "Promarcos",
                mensagem: `Telefone: ${p.telefone1}${p.telefone2 ? ` / ${p.telefone2}` : ""}`,
              });
            }
            if (p.email1) {
              results.push({
                local: "Promarcos",
                mensagem: `E-mail: ${p.email1}`,
              });
            }
            if (p.profissao) {
              results.push({
                local: "Promarcos",
                mensagem: `Profissão: ${p.profissao}`,
              });
            }
          }

          const pessoaId = data.pessoas[0].codigo;
          try {
            const procCtrl = new AbortController();
            const procTimeout = setTimeout(() => procCtrl.abort(), 15000);
            const procRes = await fetch(`${PROMARCOS_BASE}/processo?clienteId=${pessoaId}`, { signal: procCtrl.signal });
            clearTimeout(procTimeout);
            if (procRes.ok) {
              const processos = await procRes.json();
              if (Array.isArray(processos) && processos.length > 0) {
                results.push({
                  local: "Promarcos",
                  mensagem: `${processos.length} processo(s) encontrado(s)`,
                });
                for (const proc of processos.slice(0, 5)) {
                  const status = proc.StatusAtual || proc.situacao || "";
                  const beneficio = proc.beneficio || "";
                  const numero = proc.numeroprocesso || "Sem número";
                  results.push({
                    local: "Promarcos",
                    mensagem: `Processo: ${numero} | ${beneficio} | Status: ${status}`,
                  });
                }
                if (processos.length > 5) {
                  results.push({
                    local: "Promarcos",
                    mensagem: `... e mais ${processos.length - 5} processo(s)`,
                  });
                }
              }
            }
          } catch {
            results.push({
              local: "Promarcos",
              mensagem: "Erro ao consultar processos",
            });
          }
        } else {
          results.push({
            local: "Promarcos",
            mensagem: "CPF não encontrado no Promarcos",
          });
        }
      } catch {
        results.push({
          local: "Promarcos",
          mensagem: "Erro ao consultar Promarcos (timeout ou indisponível)",
        });
      }
    })();

    await Promise.all([localPromise, promarkosPromise]);

    const sorted = results.sort((a, b) => {
      if (a.local === "Sistema Local" && b.local !== "Sistema Local") return -1;
      if (a.local !== "Sistema Local" && b.local === "Sistema Local") return 1;
      return 0;
    });

    res.json(sorted);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
