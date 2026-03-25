import { Router, type IRouter } from "express";

const PROMARCOS_BASE = "https://api.onprise.com.br/api";

const router: IRouter = Router();

router.get("/promarcos/escritorios", async (req, res) => {
  try {
    const upstream = await fetch(`${PROMARCOS_BASE}/escritorios/buscartodos`);
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

router.get("/promarcos/processos/:pessoaId", async (req, res) => {
  try {
    const { pessoaId } = req.params;
    const upstream = await fetch(`${PROMARCOS_BASE}/processo?clienteId=${pessoaId}`);
    const data = await upstream.json();
    const list = Array.isArray(data) ? data : [];
    res.status(200).json(list);
  } catch (err) {
    req.log.error(err);
    res.status(502).json([]);
  }
});

router.get("/promarcos/beneficios", async (req, res) => {
  try {
    const upstream = await fetch(`${PROMARCOS_BASE}/beneficio/buscar`);
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    req.log.error(err);
    res.status(502).json([]);
  }
});

router.get("/promarcos/beneficiotipo/:beneficioId", async (req, res) => {
  try {
    const { beneficioId } = req.params;
    const upstream = await fetch(`${PROMARCOS_BASE}/beneficio/buscartipo/${beneficioId}`);
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    req.log.error(err);
    res.status(502).json([]);
  }
});

router.post("/promarcos/processos", async (req, res) => {
  try {
    const { escritorioid, beneficioid, pessoaid, dataentrada, urgencia, modo } = req.body;

    const form = new globalThis.FormData();
    form.append("escritorioid", String(escritorioid));
    form.append("beneficioid", String(beneficioid));
    form.append("pessoaid", String(pessoaid));
    form.append("dataentrada", dataentrada || new Date().toISOString().split("T")[0]);
    form.append("valorprocesso", "0");
    form.append("usuariocadastro", "1");
    form.append("datacadastro", new Date().toISOString());
    form.append("urgencia", String(urgencia ?? false));
    form.append("modo", modo || "novo");
    const emptyBlob = new Blob([""], { type: "application/octet-stream" });
    form.append("arquivo", emptyBlob, "empty.bin");

    const upstream = await fetch(`${PROMARCOS_BASE}/processo`, {
      method: "POST",
      body: form,
    });

    const text = await upstream.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    res.status(upstream.status).json(data);
  } catch (err) {
    req.log.error(err);
    res.status(502).json({ sucesso: false, mensagem: "Erro ao criar processo no Promarcos" });
  }
});

export default router;
