import { Router, type IRouter } from "express";

const PROMARCOS_BASE = "https://api.onprise.com.br/api";

const router: IRouter = Router();

router.get("/promarcos/empresas", async (req, res) => {
  try {
    const upstream = await fetch(`${PROMARCOS_BASE}/empresas/buscar`);
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    req.log.error(err);
    res.status(502).json([]);
  }
});

router.get("/promarcos/buscarcpf/:cpf", async (req, res) => {
  try {
    const { cpf } = req.params;
    const upstream = await fetch(`${PROMARCOS_BASE}/pessoas/buscarcpf/${cpf}`);
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    req.log.error(err);
    res.status(502).json({ existe: false, pessoas: [] });
  }
});

router.post("/promarcos/salvarpessoacompleta", async (req, res) => {
  try {
    const upstream = await fetch(`${PROMARCOS_BASE}/pessoas/salvarpessoacompleta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    req.log.error(err);
    res.status(502).json({ sucesso: false, mensagem: "Erro ao conectar com o Promarcos" });
  }
});

export default router;
