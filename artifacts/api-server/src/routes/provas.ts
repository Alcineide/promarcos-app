import { Router, type IRouter } from "express";
import { db, provasTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/provas/:cpf", async (req, res) => {
  try {
    const cpfRaw = req.params.cpf.replace(/\D/g, "");
    const provas = await db
      .select()
      .from(provasTable)
      .where(sql`REPLACE(REPLACE(REPLACE(${provasTable.cpf}, '.', ''), '-', ''), ' ', '') = ${cpfRaw}`)
      .orderBy(provasTable.id);
    res.json(provas);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/provas", async (req, res) => {
  try {
    const { cpf, tipoProva, descricaoProva, dataProva, idProva } = req.body as {
      cpf: string;
      tipoProva?: string;
      descricaoProva?: string;
      dataProva?: string;
      idProva?: string;
    };
    if (!cpf) {
      res.status(400).json({ error: "CPF é obrigatório" });
      return;
    }
    const [prova] = await db.insert(provasTable).values({
      cpf,
      tipoProva: tipoProva || "",
      descricaoProva: descricaoProva || "",
      dataProva: dataProva || null,
      idProva: idProva || null,
    }).returning();
    res.status(201).json(prova);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro ao gravar prova" });
  }
});

router.put("/provas/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { tipoProva, descricaoProva, dataProva, idProva } = req.body as {
      tipoProva?: string;
      descricaoProva?: string;
      dataProva?: string;
      idProva?: string;
    };
    const [prova] = await db.update(provasTable)
      .set({
        ...(tipoProva !== undefined && { tipoProva }),
        ...(descricaoProva !== undefined && { descricaoProva }),
        ...(dataProva !== undefined && { dataProva }),
        ...(idProva !== undefined && { idProva }),
      })
      .where(eq(provasTable.id, id))
      .returning();
    if (!prova) {
      res.status(404).json({ error: "Prova não encontrada" });
      return;
    }
    res.json(prova);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro ao atualizar prova" });
  }
});

router.delete("/provas/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(provasTable).where(eq(provasTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Erro ao excluir prova" });
  }
});

export default router;
