import { Router, type IRouter } from "express";
import { db, documentosAssinaturaTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import PDFDocument from "pdfkit";
import crypto from "crypto";

const router: IRouter = Router();

const ZAPSIGN_API = "https://api.zapsign.com.br/api/v1";

function getToken(): string {
  const token = process.env.ZAPSIGN_API_TOKEN;
  if (!token) throw new Error("ZAPSIGN_API_TOKEN não configurado");
  return token;
}

interface ClienteDocData {
  nomeCompleto: string;
  cpf: string;
  rg?: string;
  orgaoEmissor?: string;
  estadoCivil?: string;
  profissao?: string;
  dataNascimento?: string;
  sexo?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  escritorio?: string;
}

function dataExtenso(): string {
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const d = new Date();
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function enderecoCompleto(c: ClienteDocData): string {
  const parts = [c.logradouro];
  if (c.numero) parts.push(`nº ${c.numero}`);
  if (c.complemento) parts.push(c.complemento);
  if (c.bairro) parts.push(c.bairro);
  if (c.cidade) parts.push(c.cidade);
  if (c.estado) parts.push(c.estado);
  if (c.cep) parts.push(`CEP: ${c.cep}`);
  return parts.filter(Boolean).join(", ");
}

function qualificacao(c: ClienteDocData): string {
  const nacionalidade = "brasileiro(a)";
  const parts = [
    c.nomeCompleto?.toUpperCase(),
    nacionalidade,
    c.estadoCivil?.toLowerCase(),
    c.profissao?.toLowerCase(),
    c.rg ? `portador(a) do RG nº ${c.rg}` : null,
    c.orgaoEmissor ? `expedido pelo ${c.orgaoEmissor}` : null,
    c.cpf ? `inscrito(a) no CPF sob o nº ${c.cpf}` : null,
    `residente e domiciliado(a) em ${enderecoCompleto(c)}`,
  ];
  return parts.filter(Boolean).join(", ");
}

function gerarPdfBuffer(tipo: string, c: ClienteDocData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 72, bottom: 72, left: 72, right: 72 } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const generators: Record<string, () => void> = {
      "Procuração Extra": () => {
        doc.font("Helvetica-Bold").fontSize(14).text("PROCURAÇÃO AD JUDICIA ET EXTRA", { align: "center" });
        doc.moveDown(2);
        doc.font("Helvetica").fontSize(11);
        doc.text(`OUTORGANTE: ${qualificacao(c)}.`, { align: "justify", lineGap: 4 });
        doc.moveDown();
        doc.text(`OUTORGADO(A): MARCOS AURÉLIO DIAS SOARES MENDES, brasileiro, casado, advogado, inscrito na OAB/TO sob o nº 4.848, com escritório profissional situado na Rua 13 de Maio, nº 607, Centro, Araguaína-TO, CEP 77.804-010.`, { align: "justify", lineGap: 4 });
        doc.moveDown();
        doc.text(`PODERES: Pelo presente instrumento particular de procuração, o(a) OUTORGANTE nomeia e constitui o(a) OUTORGADO(A) como seu(sua) bastante procurador(a), a quem confere amplos poderes para o foro em geral, com a cláusula "ad judicia et extra", em qualquer Juízo, Instância ou Tribunal, podendo propor contra quem de direito as ações competentes e defendê-lo(a) nas contrárias, seguindo umas e outras até final decisão, usando os recursos legais e acompanhando-os, conferindo-lhe, ainda, poderes especiais para confessar, reconhecer a procedência do pedido, transigir, desistir, renunciar ao direito sobre que se funda a ação, receber, dar quitação e firmar compromisso, podendo agir junto a qualquer repartição pública federal, estadual ou municipal, autarquias, empresas públicas e sociedades de economia mista, podendo, ainda, substabelecer esta em outrem, com ou sem reserva de iguais poderes, dando tudo por bom, firme e valioso.`, { align: "justify", lineGap: 4 });
        doc.moveDown(2);
        doc.text(`Araguaína-TO, ${dataExtenso()}.`, { align: "right" });
        doc.moveDown(3);
        doc.text("_____________________________________________", { align: "center" });
        doc.font("Helvetica-Bold").text(c.nomeCompleto?.toUpperCase() || "", { align: "center" });
        doc.font("Helvetica").fontSize(10).text(`CPF: ${c.cpf || ""}`, { align: "center" });
      },
      "Contrato": () => {
        doc.font("Helvetica-Bold").fontSize(14).text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS", { align: "center" });
        doc.moveDown(2);
        doc.font("Helvetica").fontSize(11);
        doc.text(`Pelo presente instrumento particular de contrato de prestação de serviços advocatícios, de um lado:`, { align: "justify", lineGap: 4 });
        doc.moveDown();
        doc.font("Helvetica-Bold").text("CONTRATANTE:", { continued: true }).font("Helvetica").text(` ${qualificacao(c)}.`, { align: "justify", lineGap: 4 });
        doc.moveDown();
        doc.font("Helvetica-Bold").text("CONTRATADO:", { continued: true }).font("Helvetica").text(` MARCOS AURÉLIO DIAS SOARES MENDES, brasileiro, casado, advogado, inscrito na OAB/TO sob o nº 4.848, com escritório profissional situado na Rua 13 de Maio, nº 607, Centro, Araguaína-TO, CEP 77.804-010.`, { align: "justify", lineGap: 4 });
        doc.moveDown();
        doc.text("Têm entre si justo e contratado o seguinte:", { align: "justify", lineGap: 4 });
        doc.moveDown();
        doc.font("Helvetica-Bold").text("CLÁUSULA 1ª – DO OBJETO");
        doc.font("Helvetica").text(`O presente contrato tem por objeto a prestação de serviços advocatícios pelo CONTRATADO em favor do(a) CONTRATANTE, consistentes na representação judicial e/ou extrajudicial em processos administrativos e/ou judiciais relativos aos interesses do(a) CONTRATANTE.`, { align: "justify", lineGap: 4 });
        doc.moveDown();
        doc.font("Helvetica-Bold").text("CLÁUSULA 2ª – DOS HONORÁRIOS");
        doc.font("Helvetica").text(`Os honorários advocatícios serão fixados conforme acordo entre as partes, observando a tabela de honorários da OAB/TO e a complexidade da causa.`, { align: "justify", lineGap: 4 });
        doc.moveDown();
        doc.font("Helvetica-Bold").text("CLÁUSULA 3ª – DAS OBRIGAÇÕES DO CONTRATADO");
        doc.font("Helvetica").text(`O CONTRATADO se compromete a prestar os serviços advocatícios com zelo, dedicação e competência profissional, mantendo o(a) CONTRATANTE informado(a) sobre o andamento dos processos.`, { align: "justify", lineGap: 4 });
        doc.moveDown();
        doc.font("Helvetica-Bold").text("CLÁUSULA 4ª – DAS OBRIGAÇÕES DO(A) CONTRATANTE");
        doc.font("Helvetica").text(`O(A) CONTRATANTE se compromete a fornecer todos os documentos e informações necessárias à prestação dos serviços, bem como efetuar o pagamento dos honorários na forma convencionada.`, { align: "justify", lineGap: 4 });
        doc.moveDown();
        doc.font("Helvetica-Bold").text("CLÁUSULA 5ª – DO FORO");
        doc.font("Helvetica").text(`Fica eleito o foro da Comarca de Araguaína-TO para dirimir quaisquer dúvidas oriundas do presente contrato.`, { align: "justify", lineGap: 4 });
        doc.moveDown(2);
        doc.text(`Araguaína-TO, ${dataExtenso()}.`, { align: "right" });
        doc.moveDown(3);
        doc.text("_____________________________________________", { align: "center" });
        doc.font("Helvetica-Bold").text("CONTRATANTE", { align: "center" });
        doc.font("Helvetica").text(c.nomeCompleto?.toUpperCase() || "", { align: "center" });
        doc.moveDown(2);
        doc.text("_____________________________________________", { align: "center" });
        doc.font("Helvetica-Bold").text("CONTRATADO", { align: "center" });
        doc.font("Helvetica").text("MARCOS AURÉLIO DIAS SOARES MENDES", { align: "center" });
        doc.text("OAB/TO 4.848", { align: "center" });
      },
      "Declaração não incidência": () => {
        doc.font("Helvetica-Bold").fontSize(14).text("DECLARAÇÃO DE NÃO INCIDÊNCIA DE IMPOSTO DE RENDA", { align: "center" });
        doc.moveDown(2);
        doc.font("Helvetica").fontSize(11);
        doc.text(`Eu, ${qualificacao(c)}, DECLARO, para os devidos fins de direito, que sou isento(a) da incidência de Imposto de Renda Retido na Fonte, conforme legislação vigente.`, { align: "justify", lineGap: 4 });
        doc.moveDown();
        doc.text(`Declaro, ainda, que os rendimentos recebidos se encontram dentro da faixa de isenção prevista na tabela progressiva do IRPF, ou que faço jus à isenção por outro motivo legalmente previsto.`, { align: "justify", lineGap: 4 });
        doc.moveDown();
        doc.text(`Assumo inteira responsabilidade pelas informações aqui prestadas, estando ciente das penalidades legais em caso de declaração falsa.`, { align: "justify", lineGap: 4 });
        doc.moveDown(2);
        doc.text(`Araguaína-TO, ${dataExtenso()}.`, { align: "right" });
        doc.moveDown(3);
        doc.text("_____________________________________________", { align: "center" });
        doc.font("Helvetica-Bold").text(c.nomeCompleto?.toUpperCase() || "", { align: "center" });
        doc.font("Helvetica").fontSize(10).text(`CPF: ${c.cpf || ""}`, { align: "center" });
      },
      "Declaração Hipossuficiência": () => {
        doc.font("Helvetica-Bold").fontSize(14).text("DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA", { align: "center" });
        doc.moveDown(2);
        doc.font("Helvetica").fontSize(11);
        doc.text(`Eu, ${qualificacao(c)}, venho, por meio desta, DECLARAR, sob as penas da lei, que não disponho de recursos financeiros suficientes para arcar com as custas processuais e honorários advocatícios sem prejuízo do sustento próprio e de minha família.`, { align: "justify", lineGap: 4 });
        doc.moveDown();
        doc.text(`A presente declaração é feita com fundamento no artigo 98 e seguintes do Código de Processo Civil (Lei nº 13.105/2015), para fins de obtenção do benefício da Justiça Gratuita.`, { align: "justify", lineGap: 4 });
        doc.moveDown();
        doc.text(`Declaro, ainda, estar ciente de que a falsidade desta declaração pode implicar nas sanções previstas nos artigos 297 e 299 do Código Penal.`, { align: "justify", lineGap: 4 });
        doc.moveDown(2);
        doc.text(`Araguaína-TO, ${dataExtenso()}.`, { align: "right" });
        doc.moveDown(3);
        doc.text("_____________________________________________", { align: "center" });
        doc.font("Helvetica-Bold").text(c.nomeCompleto?.toUpperCase() || "", { align: "center" });
        doc.font("Helvetica").fontSize(10).text(`CPF: ${c.cpf || ""}`, { align: "center" });
      },
      "Termo de Risco": () => {
        doc.font("Helvetica-Bold").fontSize(14).text("TERMO DE CIÊNCIA DE RISCO PROCESSUAL", { align: "center" });
        doc.moveDown(2);
        doc.font("Helvetica").fontSize(11);
        doc.text(`Eu, ${qualificacao(c)}, na qualidade de OUTORGANTE, DECLARO que fui devidamente informado(a) pelo(a) advogado(a) MARCOS AURÉLIO DIAS SOARES MENDES, OAB/TO nº 4.848, acerca dos riscos inerentes ao processo judicial, incluindo:`, { align: "justify", lineGap: 4 });
        doc.moveDown();
        doc.text(`a) A possibilidade de resultado desfavorável (improcedência total ou parcial do pedido);`, { align: "justify", lineGap: 4 });
        doc.text(`b) A possibilidade de condenação ao pagamento de custas processuais e honorários de sucumbência;`, { align: "justify", lineGap: 4 });
        doc.text(`c) A imprevisibilidade do tempo de tramitação processual;`, { align: "justify", lineGap: 4 });
        doc.text(`d) A possibilidade de necessidade de produção de provas adicionais;`, { align: "justify", lineGap: 4 });
        doc.text(`e) A possibilidade de recurso pela parte contrária;`, { align: "justify", lineGap: 4 });
        doc.text(`f) Que o resultado final depende de decisão judicial, não podendo o advogado garantir o êxito da demanda.`, { align: "justify", lineGap: 4 });
        doc.moveDown();
        doc.text(`Declaro, ainda, que mesmo ciente dos riscos acima mencionados, desejo prosseguir com a ação judicial, autorizando o advogado a tomar todas as medidas necessárias para a defesa dos meus interesses.`, { align: "justify", lineGap: 4 });
        doc.moveDown(2);
        doc.text(`Araguaína-TO, ${dataExtenso()}.`, { align: "right" });
        doc.moveDown(3);
        doc.text("_____________________________________________", { align: "center" });
        doc.font("Helvetica-Bold").text(c.nomeCompleto?.toUpperCase() || "", { align: "center" });
        doc.font("Helvetica").fontSize(10).text(`CPF: ${c.cpf || ""}`, { align: "center" });
      },
      "Revogação": () => {
        doc.font("Helvetica-Bold").fontSize(14).text("REVOGAÇÃO DE PROCURAÇÃO", { align: "center" });
        doc.moveDown(2);
        doc.font("Helvetica").fontSize(11);
        doc.text(`Eu, ${qualificacao(c)}, venho, por meio deste instrumento, REVOGAR todos os poderes anteriormente outorgados por meio de procuração(ões) conferida(s) a qualquer advogado(a) que tenha me representado em processos judiciais e/ou extrajudiciais.`, { align: "justify", lineGap: 4 });
        doc.moveDown();
        doc.text(`A partir desta data, declaro sem efeito quaisquer procurações anteriormente outorgadas para os fins acima mencionados, devendo os outorgados cessarem imediatamente a prática de quaisquer atos em meu nome.`, { align: "justify", lineGap: 4 });
        doc.moveDown();
        doc.text(`Solicito que a presente revogação seja comunicada ao Juízo competente, para que surta seus devidos efeitos legais.`, { align: "justify", lineGap: 4 });
        doc.moveDown(2);
        doc.text(`Araguaína-TO, ${dataExtenso()}.`, { align: "right" });
        doc.moveDown(3);
        doc.text("_____________________________________________", { align: "center" });
        doc.font("Helvetica-Bold").text(c.nomeCompleto?.toUpperCase() || "", { align: "center" });
        doc.font("Helvetica").fontSize(10).text(`CPF: ${c.cpf || ""}`, { align: "center" });
      },
    };

    const gen = generators[tipo];
    if (gen) gen();
    doc.end();
  });
}

function formatCpfSlug(cpf: string): string {
  return cpf.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function buildFileName(tipo: string, cpf: string): string {
  const slugMap: Record<string, string> = {
    "Procuração Extra": "Procuracao_extra",
    "Contrato": "Contrato",
    "Declaração não incidência": "Declaracao_nao_incidencia",
    "Declaração Hipossuficiência": "Declaracao_hipossuficiencia",
    "Termo de Risco": "Termo_conhecimento",
    "Revogação": "Revogacao_procuracao",
  };
  const slug = slugMap[tipo] || tipo.replace(/\s+/g, "_");
  const now = new Date();
  const ts = now.getFullYear().toString() +
    (now.getMonth()+1).toString().padStart(2,"0") +
    now.getDate().toString().padStart(2,"0") +
    now.getHours().toString().padStart(2,"0") +
    now.getMinutes().toString().padStart(2,"0") +
    now.getSeconds().toString().padStart(2,"0");
  return `${slug}_${formatCpfSlug(cpf)}_${ts}.pdf`;
}

const TIPOS_VALIDOS = ["Procuração Extra", "Contrato", "Declaração não incidência", "Declaração Hipossuficiência", "Termo de Risco", "Revogação"];

function buildSignerData(cliente: ClienteDocData) {
  return {
    name: cliente.nomeCompleto,
    email: cliente.email || "",
    phone_country: "55",
    phone_number: (cliente.telefone || "").replace(/\D/g, ""),
    auth_mode: "assinaturaTela",
    send_automatic_email: false,
    send_automatic_whatsapp: true,
  };
}

async function enviarParaZapSign(base64Pdf: string, nomeArquivo: string, cliente: ClienteDocData, apiToken: string) {
  const zapBody = {
    sandbox: false,
    name: nomeArquivo,
    lang: "pt-br",
    disable_signer_emails: false,
    signers: [buildSignerData(cliente)],
    doc_base64: base64Pdf,
  };

  const zapRes = await fetch(`${ZAPSIGN_API}/docs/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiToken}`,
    },
    body: JSON.stringify(zapBody),
  });

  if (!zapRes.ok) {
    const errText = await zapRes.text();
    throw new Error(`ZapSign API error ${zapRes.status}: ${errText}`);
  }

  const zapData = await zapRes.json() as {
    token: string;
    signers: Array<{ token: string; sign_url: string }>;
    original_file?: string;
  };

  return {
    token: zapData.token,
    signerToken: zapData.signers?.[0]?.token || null,
    signUrl: zapData.signers?.[0]?.sign_url || null,
    originalFile: zapData.original_file || null,
  };
}

async function anexarDocumentoExtraZapSign(tokenPrincipal: string, nomeDocumento: string, base64Pdf: string, apiToken: string) {
  const payload = {
    name: nomeDocumento,
    doc_base64: base64Pdf,
  };

  const zapRes = await fetch(`${ZAPSIGN_API}/docs/${tokenPrincipal}/upload-extra-doc/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!zapRes.ok) {
    const errText = await zapRes.text();
    throw new Error(`ZapSign extra doc error ${zapRes.status}: ${errText}`);
  }

  const data = await zapRes.json() as { token: string };
  return { token: data.token };
}

router.post("/zapsign/gerar-e-enviar", async (req, res) => {
  try {
    const { tipo, cliente, clienteId } = req.body as { tipo: string; cliente: ClienteDocData; clienteId?: number };

    if (!tipo || !cliente?.nomeCompleto || !cliente?.cpf) {
      res.status(400).json({ mensagem: "Tipo de documento e dados do cliente são obrigatórios" });
      return;
    }

    if (!TIPOS_VALIDOS.includes(tipo)) {
      res.status(400).json({ mensagem: `Tipo de documento inválido: ${tipo}` });
      return;
    }

    const apiToken = getToken();
    const pdfBuffer = await gerarPdfBuffer(tipo, cliente);
    const base64Pdf = pdfBuffer.toString("base64");
    const nomeArquivo = buildFileName(tipo, cliente.cpf);

    const result = await enviarParaZapSign(base64Pdf, nomeArquivo, cliente, apiToken);

    const [registro] = await db.insert(documentosAssinaturaTable).values({
      clienteId: clienteId || null,
      cpf: cliente.cpf.replace(/\D/g, ""),
      tipoDocumento: tipo,
      nomeArquivo,
      zapsignDocToken: result.token,
      zapsignSignerToken: result.signerToken,
      urlAssinatura: result.signUrl,
      statusAssinatura: "pendente",
      urlPdfOriginal: result.originalFile,
    }).returning();

    res.json({
      sucesso: true,
      documento: {
        id: registro.id,
        nomeArquivo,
        tipoDocumento: tipo,
        statusAssinatura: "pendente",
        createdAt: registro.createdAt.toISOString(),
      },
    });
  } catch (err: any) {
    req.log.error(err);
    if (err.message?.includes("ZAPSIGN_API_TOKEN")) {
      res.status(500).json({ mensagem: "Token do ZapSign não configurado. Configure a variável ZAPSIGN_API_TOKEN." });
      return;
    }
    res.status(500).json({ mensagem: "Erro ao processar documento" });
  }
});

router.post("/zapsign/gerar-todos", async (req, res) => {
  try {
    const { cliente, clienteId } = req.body as { cliente: ClienteDocData; clienteId?: number };
    if (!cliente?.nomeCompleto || !cliente?.cpf) {
      res.status(400).json({ mensagem: "Dados do cliente são obrigatórios" });
      return;
    }

    const apiToken = getToken();
    const tipos = [...TIPOS_VALIDOS];
    const loteGrupoId = crypto.randomUUID();
    const resultados: any[] = [];

    const primeiroPdf = await gerarPdfBuffer(tipos[0], cliente);
    const primeiroBase64 = primeiroPdf.toString("base64");
    const primeiroNome = buildFileName(tipos[0], cliente.cpf);

    const principal = await enviarParaZapSign(primeiroBase64, primeiroNome, cliente, apiToken);

    const [regPrincipal] = await db.insert(documentosAssinaturaTable).values({
      clienteId: clienteId || null,
      cpf: cliente.cpf.replace(/\D/g, ""),
      tipoDocumento: tipos[0],
      nomeArquivo: primeiroNome,
      zapsignDocToken: principal.token,
      zapsignSignerToken: principal.signerToken,
      urlAssinatura: principal.signUrl,
      statusAssinatura: "pendente",
      urlPdfOriginal: principal.originalFile,
      isLotePrincipal: true,
      loteGrupoId,
    }).returning();

    resultados.push({ tipo: tipos[0], sucesso: true, id: regPrincipal.id });

    for (let i = 1; i < tipos.length; i++) {
      const tipo = tipos[i];
      try {
        const pdfBuffer = await gerarPdfBuffer(tipo, cliente);
        const base64Pdf = pdfBuffer.toString("base64");
        const nomeArquivo = buildFileName(tipo, cliente.cpf);

        const extraResult = await anexarDocumentoExtraZapSign(principal.token, nomeArquivo, base64Pdf, apiToken);

        const [reg] = await db.insert(documentosAssinaturaTable).values({
          clienteId: clienteId || null,
          cpf: cliente.cpf.replace(/\D/g, ""),
          tipoDocumento: tipo,
          nomeArquivo,
          zapsignDocToken: extraResult.token,
          zapsignSignerToken: principal.signerToken,
          urlAssinatura: principal.signUrl,
          statusAssinatura: "pendente",
          isLotePrincipal: false,
          loteGrupoId,
        }).returning();

        resultados.push({ tipo, sucesso: true, id: reg.id });
      } catch (err) {
        req.log.error(err, `Erro ao anexar doc extra: ${tipo}`);
        resultados.push({ tipo, sucesso: false, erro: "Erro ao anexar" });
      }
    }

    const falhas = resultados.filter(r => !r.sucesso).length;
    res.json({
      sucesso: falhas === 0,
      parcial: falhas > 0 && falhas < tipos.length,
      signUrl: principal.signUrl,
      resultados,
      mensagem: falhas === 0
        ? "Todos os documentos gerados e vinculados para assinatura"
        : `${tipos.length - falhas} de ${tipos.length} documentos gerados`,
    });
  } catch (err: any) {
    req.log.error(err);
    if (err.message?.includes("ZAPSIGN_API_TOKEN")) {
      res.status(500).json({ mensagem: "Token do ZapSign não configurado." });
      return;
    }
    res.status(500).json({ mensagem: "Erro ao processar documentos" });
  }
});

router.get("/zapsign/documentos/:cpf", async (req, res) => {
  try {
    const cpf = req.params.cpf.replace(/\D/g, "");
    const documentos = await db
      .select()
      .from(documentosAssinaturaTable)
      .where(eq(documentosAssinaturaTable.cpf, cpf))
      .orderBy(documentosAssinaturaTable.createdAt);

    res.json(documentos.map(d => ({
      id: d.id,
      cpf: d.cpf,
      tipoDocumento: d.tipoDocumento,
      nomeArquivo: d.nomeArquivo,
      statusAssinatura: d.statusAssinatura,
      urlPdfOriginal: d.urlPdfOriginal,
      urlPdfAssinado: d.urlPdfAssinado,
      urlAssinatura: d.urlAssinatura,
      isLotePrincipal: d.isLotePrincipal,
      loteGrupoId: d.loteGrupoId,
      dataAssinatura: d.dataAssinatura?.toISOString() || null,
      createdAt: d.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ mensagem: "Erro ao buscar documentos" });
  }
});

router.post("/zapsign/assinar/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [doc] = await db.select().from(documentosAssinaturaTable).where(eq(documentosAssinaturaTable.id, id));
    if (!doc) {
      res.status(404).json({ mensagem: "Documento não encontrado" });
      return;
    }

    if (doc.urlAssinatura) {
      res.json({ url: doc.urlAssinatura });
      return;
    }

    if (doc.zapsignDocToken) {
      const url = `https://app.zapsign.com.br/verificar/${doc.zapsignDocToken}`;
      res.json({ url });
      return;
    }

    res.status(400).json({ mensagem: "Link de assinatura não disponível" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ mensagem: "Erro ao obter link de assinatura" });
  }
});

router.get("/zapsign/status/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [doc] = await db.select().from(documentosAssinaturaTable).where(eq(documentosAssinaturaTable.id, id));
    if (!doc || !doc.zapsignDocToken) {
      res.status(404).json({ mensagem: "Documento não encontrado" });
      return;
    }

    const apiToken = getToken();
    const zapRes = await fetch(`${ZAPSIGN_API}/docs/${doc.zapsignDocToken}/`, {
      headers: { "Authorization": `Bearer ${apiToken}` },
    });

    if (!zapRes.ok) {
      res.status(502).json({ mensagem: "Erro ao consultar ZapSign" });
      return;
    }

    const zapData = await zapRes.json() as {
      status: string;
      signed_file?: string;
    };

    let novoStatus = doc.statusAssinatura;
    if (zapData.status === "signed") {
      novoStatus = "assinado";
      await db.update(documentosAssinaturaTable)
        .set({
          statusAssinatura: "assinado",
          urlPdfAssinado: zapData.signed_file || null,
          signedFile: zapData.signed_file || null,
          dataAssinatura: new Date(),
        })
        .where(eq(documentosAssinaturaTable.id, id));
    }

    res.json({ status: novoStatus, signedFile: zapData.signed_file || null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ mensagem: "Erro ao verificar status" });
  }
});

router.delete("/zapsign/documento/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [doc] = await db.select().from(documentosAssinaturaTable).where(eq(documentosAssinaturaTable.id, id));
    if (!doc) {
      res.status(404).json({ mensagem: "Documento não encontrado" });
      return;
    }

    if (doc.loteGrupoId) {
      const loteDocs = await db.select()
        .from(documentosAssinaturaTable)
        .where(eq(documentosAssinaturaTable.loteGrupoId, doc.loteGrupoId));

      const principal = loteDocs.find(d => d.isLotePrincipal);
      if (principal?.zapsignDocToken) {
        try {
          const apiToken = getToken();
          await fetch(`${ZAPSIGN_API}/docs/${principal.zapsignDocToken}/`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${apiToken}` },
          });
        } catch {}
      }

      for (const d of loteDocs) {
        await db.delete(documentosAssinaturaTable).where(eq(documentosAssinaturaTable.id, d.id));
      }

      res.json({ sucesso: true, removidos: loteDocs.length });
    } else {
      if (doc.zapsignDocToken) {
        try {
          const apiToken = getToken();
          await fetch(`${ZAPSIGN_API}/docs/${doc.zapsignDocToken}/`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${apiToken}` },
          });
        } catch {}
      }

      await db.delete(documentosAssinaturaTable).where(eq(documentosAssinaturaTable.id, id));
      res.json({ sucesso: true, removidos: 1 });
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ mensagem: "Erro ao excluir documento" });
  }
});

router.post("/zapsign/webhook", async (req, res) => {
  try {
    const payload = req.body as {
      event_type: string;
      token: string;
      status: string;
      signed_file?: string;
      original_file?: string;
      extra_docs?: Array<{ token: string; name: string; signed_file: string }>;
    };

    if (!payload) {
      res.status(400).json({ mensagem: "Payload vazio" });
      return;
    }

    req.log.info({ event: payload.event_type, token: payload.token, status: payload.status }, "ZapSign webhook received");

    if (payload.event_type === "doc_signed" || payload.status === "signed") {
      const [doc] = await db.select()
        .from(documentosAssinaturaTable)
        .where(eq(documentosAssinaturaTable.zapsignDocToken, payload.token));

      if (doc) {
        await db.update(documentosAssinaturaTable)
          .set({
            statusAssinatura: "assinado",
            urlPdfAssinado: payload.signed_file || null,
            signedFile: payload.signed_file || null,
            dataAssinatura: new Date(),
          })
          .where(eq(documentosAssinaturaTable.id, doc.id));
      }

      if (payload.extra_docs?.length) {
        for (const extra of payload.extra_docs) {
          const [extraDoc] = await db.select()
            .from(documentosAssinaturaTable)
            .where(eq(documentosAssinaturaTable.zapsignDocToken, extra.token));
          if (extraDoc) {
            await db.update(documentosAssinaturaTable)
              .set({
                statusAssinatura: "assinado",
                urlPdfAssinado: extra.signed_file || null,
                signedFile: extra.signed_file || null,
                dataAssinatura: new Date(),
              })
              .where(eq(documentosAssinaturaTable.id, extraDoc.id));
          }
        }
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    req.log.error(err, "ZapSign webhook error");
    res.status(500).json({ mensagem: "Erro ao processar webhook" });
  }
});

router.post("/zapsign/atualizar-status/:cpf", async (req, res) => {
  try {
    const cpf = req.params.cpf.replace(/\D/g, "");
    const apiToken = getToken();
    const documentos = await db
      .select()
      .from(documentosAssinaturaTable)
      .where(and(
        eq(documentosAssinaturaTable.cpf, cpf),
        eq(documentosAssinaturaTable.statusAssinatura, "pendente")
      ));

    let atualizados = 0;
    for (const doc of documentos) {
      if (!doc.zapsignDocToken) continue;
      try {
        const zapRes = await fetch(`${ZAPSIGN_API}/docs/${doc.zapsignDocToken}/`, {
          headers: { "Authorization": `Bearer ${apiToken}` },
        });
        if (!zapRes.ok) continue;
        const zapData = await zapRes.json() as { status: string; signed_file?: string };
        if (zapData.status === "signed") {
          await db.update(documentosAssinaturaTable)
            .set({
              statusAssinatura: "assinado",
              urlPdfAssinado: zapData.signed_file || null,
              signedFile: zapData.signed_file || null,
              dataAssinatura: new Date(),
            })
            .where(eq(documentosAssinaturaTable.id, doc.id));
          atualizados++;
        }
      } catch {}
    }

    res.json({ atualizados });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ mensagem: "Erro ao atualizar status" });
  }
});

export default router;
