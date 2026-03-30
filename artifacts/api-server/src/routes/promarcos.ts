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
    const upstream = await fetch(`${PROMARCOS_BASE}/processo?clienteId=${pessoaId}`, {
      cache: "no-store",
    });
    const data = await upstream.json();
    const raw = Array.isArray(data) ? data : [];
    const seen = new Set<unknown>();
    const list = raw.filter((p: { id?: unknown }) => {
      if (p?.id === undefined || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
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
    const { escritorioid, beneficioid, pessoaid, dataentrada, urgencia,
            numeroprocesso, observacoes, numeropasta, usuariocadastro } = req.body;

    const payload: Record<string, unknown> = {
      escritorioid: Number(escritorioid),
      beneficioid: Number(beneficioid),
      pessoaid: Number(pessoaid),
      dataentrada: dataentrada || new Date().toISOString().split("T")[0],
      valorprocesso: 0,
      usuariocadastro: usuariocadastro ? Number(usuariocadastro) : 32,
      urgencia: Boolean(urgencia ?? false),
      GerarFluxo: false,
      numeropasta: numeropasta ? Number(numeropasta) : 0,
    };
    if (numeroprocesso) payload.numeroprocesso = String(numeroprocesso);
    if (observacoes) payload.observacoes = String(observacoes);

    const upstream = await fetch(`${PROMARCOS_BASE}/processo/simples`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    req.log.info({ status: upstream.status, body: text.substring(0, 300) }, "Promarcos POST /processo/simples response");
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    res.status(upstream.status).json(data);
  } catch (err) {
    req.log.error(err);
    res.status(502).json({ sucesso: false, mensagem: "Erro ao criar processo no Promarcos" });
  }
});

router.put("/promarcos/processos/:processoId", async (req, res) => {
  try {
    const { processoId } = req.params;
    const { escritorioid, beneficioid, pessoaid, dataentrada, urgencia, modo,
            numeroprocesso, fluxo, estagio, observacoes, fatogerador,
            numeropasta, terrapropia, incra, vinculoemprego } = req.body;

    const payload: Record<string, unknown> = {
      escritorioid: Number(escritorioid),
      beneficioid: Number(beneficioid),
      pessoaid: Number(pessoaid),
      dataentrada: dataentrada || new Date().toISOString().split("T")[0],
      valorprocesso: 0,
      usuariocadastro: "1",
      urgencia: Boolean(urgencia),
      modo: modo || "existente",
      GerarFluxo: false,
    };
    if (numeroprocesso !== undefined) payload.numeroprocesso = String(numeroprocesso);
    if (fluxo !== undefined) payload.fluxo = String(fluxo);
    if (estagio !== undefined) payload.estagio = String(estagio);
    if (observacoes !== undefined) payload.observacoes = String(observacoes);
    if (fatogerador !== undefined) payload.fatogerador = String(fatogerador);
    if (numeropasta !== undefined && numeropasta !== "") payload.numeropasta = Number(numeropasta);
    if (terrapropia !== undefined) payload.terrapropia = Boolean(terrapropia);
    if (incra !== undefined) payload.incra = Boolean(incra);
    if (vinculoemprego !== undefined) payload.vinculoemprego = String(vinculoemprego);

    const upstream = await fetch(`${PROMARCOS_BASE}/processo/edit/${processoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    res.status(upstream.status).json(data);
  } catch (err) {
    req.log.error(err);
    res.status(502).json({ sucesso: false, mensagem: "Erro ao editar processo no Promarcos" });
  }
});

router.get("/promarcos/buscarsocio/:termo", async (req, res) => {
  try {
    const { termo } = req.params;
    const upstream = await fetch(`${PROMARCOS_BASE}/pessoas/buscarsocio/${encodeURIComponent(termo)}`);
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    req.log.error(err);
    res.status(502).json([]);
  }
});

router.get("/promarcos/comissao/processo/:processoId", async (req, res) => {
  try {
    const { processoId } = req.params;
    const upstream = await fetch(`${PROMARCOS_BASE}/comissao/processo/${processoId}`);
    const data = await upstream.json();
    const list = Array.isArray(data) ? data : [];
    res.status(200).json(list);
  } catch (err) {
    req.log.error(err);
    res.status(502).json([]);
  }
});

router.post("/promarcos/comissao", async (req, res) => {
  try {
    const upstream = await fetch(`${PROMARCOS_BASE}/comissao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    req.log.error(err);
    res.status(502).json({ sucesso: false });
  }
});

router.post("/promarcos/comissao/del/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const upstream = await fetch(`${PROMARCOS_BASE}/comissao/del/${id}`, { method: "POST" });
    res.status(upstream.status).json({ sucesso: true });
  } catch (err) {
    req.log.error(err);
    res.status(502).json({ sucesso: false });
  }
});

router.get("/promarcos/socios/processo/:processoId", async (req, res) => {
  try {
    const { processoId } = req.params;
    const upstream = await fetch(`${PROMARCOS_BASE}/socios/processo/${processoId}`);
    const data = await upstream.json();
    const list = Array.isArray(data) ? data : [];
    res.status(200).json(list);
  } catch (err) {
    req.log.error(err);
    res.status(502).json([]);
  }
});

router.post("/promarcos/socios", async (req, res) => {
  try {
    const upstream = await fetch(`${PROMARCOS_BASE}/socios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    req.log.error(err);
    res.status(502).json({ sucesso: false });
  }
});

router.post("/promarcos/socios/del/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const upstream = await fetch(`${PROMARCOS_BASE}/socios/del/${id}`, { method: "POST" });
    res.status(upstream.status).json({ sucesso: true });
  } catch (err) {
    req.log.error(err);
    res.status(502).json({ sucesso: false });
  }
});

router.get("/promarcos/folharosto/:pessoaId", async (req, res) => {
  try {
    const { pessoaId } = req.params;
    const upstream = await fetch(`${PROMARCOS_BASE}/pessoas/relatorio/${pessoaId}/1`);
    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(upstream.status).send(text);
      return;
    }
    const contentType = upstream.headers.get("content-type") || "application/pdf";
    const contentDisposition = upstream.headers.get("content-disposition") || `attachment; filename="folha_rosto_${pessoaId}.pdf"`;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", contentDisposition);
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    req.log.error(err);
    res.status(502).json({ mensagem: "Erro ao gerar folha de rosto" });
  }
});

router.post("/promarcos/arquivo", async (req, res) => {
  try {
    const { pessoaCodigo, fileName, fileBase64, tipo, nome, mimeType } = req.body as {
      pessoaCodigo: number;
      fileName: string;
      fileBase64: string;
      tipo?: string;
      nome?: string;
      mimeType?: string;
    };

    const pessoaJson = JSON.stringify({ codigo: pessoaCodigo });
    const fileBuffer = Buffer.from(fileBase64, "base64");
    const resolvedMime = mimeType || (fileName?.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    let resolvedFileName = fileName || "documento.jpg";
    if (resolvedMime === "application/pdf" && !resolvedFileName.toLowerCase().endsWith(".pdf")) {
      resolvedFileName = resolvedFileName + ".pdf";
    }
    const blob = new Blob([fileBuffer], { type: resolvedMime });

    const form = new globalThis.FormData();
    form.append("pessoa", pessoaJson);
    form.append("arquivos", blob, resolvedFileName);
    form.append("tipos", tipo || "Documento");
    form.append("nomes", nome || resolvedFileName || "Documento");

    const upstream = await fetch(`${PROMARCOS_BASE}/pessoas/arquivo`, {
      method: "POST",
      body: form,
    });

    const text = await upstream.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    res.status(upstream.status).json(data);
  } catch (err) {
    req.log.error(err);
    res.status(502).json({ sucesso: false, mensagem: "Erro ao enviar arquivo ao Promarcos" });
  }
});

router.post("/promarcos/login", async (req, res) => {
  try {
    const { email, senha } = req.body as { email: string; senha: string };
    const upstream = await fetch(`${PROMARCOS_BASE}/usuarios/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
    const text = await upstream.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { mensagem: text }; }
    res.status(upstream.status).json(data);
  } catch (err) {
    req.log.error(err);
    res.status(502).json({ mensagem: "Erro ao conectar com o servidor" });
  }
});

router.get("/promarcos/pessoas/arquivos/:pessoaCodigo", async (req, res) => {
  try {
    const { pessoaCodigo } = req.params;
    const upstream = await fetch(`${PROMARCOS_BASE}/pessoas/arquivo/${pessoaCodigo}`);
    const text = await upstream.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { mensagem: text }; }
    res.status(upstream.status).json(data);
  } catch (err) {
    req.log.error(err);
    res.status(502).json([]);
  }
});

export default router;
