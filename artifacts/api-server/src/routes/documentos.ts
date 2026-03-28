import { Router, type IRouter } from "express";
import PDFDocument from "pdfkit";

const router: IRouter = Router();

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

function createPDF(title: string, bodyFn: (doc: PDFKit.PDFDocument, c: ClienteDocData) => void, cliente: ClienteDocData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margins: { top: 72, bottom: 72, left: 72, right: 72 } });

  doc.font("Helvetica-Bold").fontSize(14).text(title.toUpperCase(), { align: "center" });
  doc.moveDown(2);

  bodyFn(doc, cliente);

  return doc;
}

function gerarProcuracaoExtra(c: ClienteDocData): PDFKit.PDFDocument {
  return createPDF("PROCURAÇÃO AD JUDICIA ET EXTRA", (doc, cl) => {
    doc.font("Helvetica").fontSize(11);
    doc.text(`OUTORGANTE: ${qualificacao(cl)}.`, { align: "justify", lineGap: 4 });
    doc.moveDown();
    doc.text(`OUTORGADO(A): MARCOS AURÉLIO DIAS SOARES MENDES, brasileiro, casado, advogado, inscrito na OAB/TO sob o nº 4.848, com escritório profissional situado na Rua 13 de Maio, nº 607, Centro, Araguaína-TO, CEP 77.804-010.`, { align: "justify", lineGap: 4 });
    doc.moveDown();
    doc.text(`PODERES: Pelo presente instrumento particular de procuração, o(a) OUTORGANTE nomeia e constitui o(a) OUTORGADO(A) como seu(sua) bastante procurador(a), a quem confere amplos poderes para o foro em geral, com a cláusula "ad judicia et extra", em qualquer Juízo, Instância ou Tribunal, podendo propor contra quem de direito as ações competentes e defendê-lo(a) nas contrárias, seguindo umas e outras até final decisão, usando os recursos legais e acompanhando-os, conferindo-lhe, ainda, poderes especiais para confessar, reconhecer a procedência do pedido, transigir, desistir, renunciar ao direito sobre que se funda a ação, receber, dar quitação e firmar compromisso, podendo agir junto a qualquer repartição pública federal, estadual ou municipal, autarquias, empresas públicas e sociedades de economia mista, podendo, ainda, substabelecer esta em outrem, com ou sem reserva de iguais poderes, dando tudo por bom, firme e valioso.`, { align: "justify", lineGap: 4 });
    doc.moveDown(2);
    doc.text(`Araguaína-TO, ${dataExtenso()}.`, { align: "right" });
    doc.moveDown(3);
    doc.text("_____________________________________________", { align: "center" });
    doc.font("Helvetica-Bold").text(cl.nomeCompleto?.toUpperCase() || "", { align: "center" });
    doc.font("Helvetica").fontSize(10).text(`CPF: ${cl.cpf || ""}`, { align: "center" });
  }, c);
}

function gerarContrato(c: ClienteDocData): PDFKit.PDFDocument {
  return createPDF("CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS", (doc, cl) => {
    doc.font("Helvetica").fontSize(11);
    doc.text(`Pelo presente instrumento particular de contrato de prestação de serviços advocatícios, de um lado:`, { align: "justify", lineGap: 4 });
    doc.moveDown();
    doc.font("Helvetica-Bold").text("CONTRATANTE:", { continued: true }).font("Helvetica").text(` ${qualificacao(cl)}.`, { align: "justify", lineGap: 4 });
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
    doc.font("Helvetica").text(cl.nomeCompleto?.toUpperCase() || "", { align: "center" });
    doc.moveDown(2);
    doc.text("_____________________________________________", { align: "center" });
    doc.font("Helvetica-Bold").text("CONTRATADO", { align: "center" });
    doc.font("Helvetica").text("MARCOS AURÉLIO DIAS SOARES MENDES", { align: "center" });
    doc.text("OAB/TO 4.848", { align: "center" });
  }, c);
}

function gerarDeclNaoIncidencia(c: ClienteDocData): PDFKit.PDFDocument {
  return createPDF("DECLARAÇÃO DE NÃO INCIDÊNCIA DE IMPOSTO DE RENDA", (doc, cl) => {
    doc.font("Helvetica").fontSize(11);
    doc.text(`Eu, ${qualificacao(cl)}, DECLARO, para os devidos fins de direito, que sou isento(a) da incidência de Imposto de Renda Retido na Fonte, conforme legislação vigente.`, { align: "justify", lineGap: 4 });
    doc.moveDown();
    doc.text(`Declaro, ainda, que os rendimentos recebidos se encontram dentro da faixa de isenção prevista na tabela progressiva do IRPF, ou que faço jus à isenção por outro motivo legalmente previsto.`, { align: "justify", lineGap: 4 });
    doc.moveDown();
    doc.text(`Assumo inteira responsabilidade pelas informações aqui prestadas, estando ciente das penalidades legais em caso de declaração falsa.`, { align: "justify", lineGap: 4 });
    doc.moveDown(2);
    doc.text(`Araguaína-TO, ${dataExtenso()}.`, { align: "right" });
    doc.moveDown(3);
    doc.text("_____________________________________________", { align: "center" });
    doc.font("Helvetica-Bold").text(cl.nomeCompleto?.toUpperCase() || "", { align: "center" });
    doc.font("Helvetica").fontSize(10).text(`CPF: ${cl.cpf || ""}`, { align: "center" });
  }, c);
}

function gerarDeclHipossuficiencia(c: ClienteDocData): PDFKit.PDFDocument {
  return createPDF("DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA", (doc, cl) => {
    doc.font("Helvetica").fontSize(11);
    doc.text(`Eu, ${qualificacao(cl)}, venho, por meio desta, DECLARAR, sob as penas da lei, que não disponho de recursos financeiros suficientes para arcar com as custas processuais e honorários advocatícios sem prejuízo do sustento próprio e de minha família.`, { align: "justify", lineGap: 4 });
    doc.moveDown();
    doc.text(`A presente declaração é feita com fundamento no artigo 98 e seguintes do Código de Processo Civil (Lei nº 13.105/2015), para fins de obtenção do benefício da Justiça Gratuita.`, { align: "justify", lineGap: 4 });
    doc.moveDown();
    doc.text(`Declaro, ainda, estar ciente de que a falsidade desta declaração pode implicar nas sanções previstas nos artigos 297 e 299 do Código Penal.`, { align: "justify", lineGap: 4 });
    doc.moveDown(2);
    doc.text(`Araguaína-TO, ${dataExtenso()}.`, { align: "right" });
    doc.moveDown(3);
    doc.text("_____________________________________________", { align: "center" });
    doc.font("Helvetica-Bold").text(cl.nomeCompleto?.toUpperCase() || "", { align: "center" });
    doc.font("Helvetica").fontSize(10).text(`CPF: ${cl.cpf || ""}`, { align: "center" });
  }, c);
}

function gerarTermoRisco(c: ClienteDocData): PDFKit.PDFDocument {
  return createPDF("TERMO DE CIÊNCIA DE RISCO PROCESSUAL", (doc, cl) => {
    doc.font("Helvetica").fontSize(11);
    doc.text(`Eu, ${qualificacao(cl)}, na qualidade de OUTORGANTE, DECLARO que fui devidamente informado(a) pelo(a) advogado(a) MARCOS AURÉLIO DIAS SOARES MENDES, OAB/TO nº 4.848, acerca dos riscos inerentes ao processo judicial, incluindo:`, { align: "justify", lineGap: 4 });
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
    doc.font("Helvetica-Bold").text(cl.nomeCompleto?.toUpperCase() || "", { align: "center" });
    doc.font("Helvetica").fontSize(10).text(`CPF: ${cl.cpf || ""}`, { align: "center" });
  }, c);
}

function gerarRevogacao(c: ClienteDocData): PDFKit.PDFDocument {
  return createPDF("REVOGAÇÃO DE PROCURAÇÃO", (doc, cl) => {
    doc.font("Helvetica").fontSize(11);
    doc.text(`Eu, ${qualificacao(cl)}, venho, por meio deste instrumento, REVOGAR todos os poderes anteriormente outorgados por meio de procuração(ões) conferida(s) a qualquer advogado(a) que tenha me representado em processos judiciais e/ou extrajudiciais.`, { align: "justify", lineGap: 4 });
    doc.moveDown();
    doc.text(`A partir desta data, declaro sem efeito quaisquer procurações anteriormente outorgadas para os fins acima mencionados, devendo os outorgados cessarem imediatamente a prática de quaisquer atos em meu nome.`, { align: "justify", lineGap: 4 });
    doc.moveDown();
    doc.text(`Solicito que a presente revogação seja comunicada ao Juízo competente, para que surta seus devidos efeitos legais.`, { align: "justify", lineGap: 4 });
    doc.moveDown(2);
    doc.text(`Araguaína-TO, ${dataExtenso()}.`, { align: "right" });
    doc.moveDown(3);
    doc.text("_____________________________________________", { align: "center" });
    doc.font("Helvetica-Bold").text(cl.nomeCompleto?.toUpperCase() || "", { align: "center" });
    doc.font("Helvetica").fontSize(10).text(`CPF: ${cl.cpf || ""}`, { align: "center" });
  }, c);
}

const docGenerators: Record<string, (c: ClienteDocData) => PDFKit.PDFDocument> = {
  "Procuração Extra": gerarProcuracaoExtra,
  "Contrato": gerarContrato,
  "Declaração não incidência": gerarDeclNaoIncidencia,
  "Declaração Hipossuficiência": gerarDeclHipossuficiencia,
  "Termo de Risco": gerarTermoRisco,
  "Revogação": gerarRevogacao,
};

router.post("/documentos/gerar", async (req, res) => {
  try {
    const { tipo, cliente } = req.body as { tipo: string; cliente: ClienteDocData };

    if (!tipo || !cliente?.nomeCompleto || !cliente?.cpf) {
      res.status(400).json({ mensagem: "Tipo de documento e dados do cliente são obrigatórios" });
      return;
    }

    const generator = docGenerators[tipo];
    if (!generator) {
      res.status(400).json({ mensagem: `Tipo de documento desconhecido: ${tipo}` });
      return;
    }

    const pdfDoc = generator(cliente);
    const slugTipo = tipo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").toLowerCase();
    const slugNome = (cliente.nomeCompleto || "cliente").replace(/\s+/g, "_").substring(0, 30);
    const fileName = `${slugTipo}_${slugNome}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ mensagem: "Erro ao gerar documento" });
  }
});

router.post("/documentos/gerar-todos", async (req, res) => {
  try {
    const { cliente } = req.body as { cliente: ClienteDocData };
    if (!cliente?.nomeCompleto || !cliente?.cpf) {
      res.status(400).json({ mensagem: "Dados do cliente são obrigatórios" });
      return;
    }

    const results: { tipo: string; sucesso: boolean }[] = [];
    for (const tipo of Object.keys(docGenerators)) {
      results.push({ tipo, sucesso: true });
    }

    res.json({ sucesso: true, documentos: results, mensagem: "Use o endpoint individual para baixar cada documento." });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ mensagem: "Erro ao gerar documentos" });
  }
});

export default router;
