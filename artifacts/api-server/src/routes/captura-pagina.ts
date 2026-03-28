import { Router, type IRouter } from "express";
import puppeteer from "puppeteer-core";

const router: IRouter = Router();

const CHROMIUM_PATH = "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";

const SITE_CONFIGS: Record<string, { url: string; selectorCpf?: string; selectorSubmit?: string; waitFor?: string }> = {
  dap: { url: "https://smap14.mda.gov.br/extratodap/PesquisarDAP" },
  caf: { url: "https://caf.mda.gov.br/consulta-publica/ufpa" },
  incra: { url: "https://saladacidadania.incra.gov.br" },
  sncr: { url: "https://sncr.serpro.gov.br/sncr/public/pages/consulta/consultaImovelPublicoByCpfCnpj.jsf" },
  sigef: { url: "https://sigef.incra.gov.br/geo/parcela/" },
  registro_rural: { url: "https://www.registrorural.com.br" },
  pesqbrasil: { url: "https://sistemas.mpa.gov.br/pesqbrasil/publico/pesquisa" },
  sisrgp: { url: "https://sistemas.mpa.gov.br/sisrgp/pages/consultar/consultarLicencaPublico.jsf" },
  cnd_to: { url: "https://app.sefaz.to.gov.br/SINTEGRA-WEB/" },
  contag: { url: "https://www.contag.org.br" },
  pje_trf1: { url: "https://pje1g.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam" },
  trf1_secao_to: { url: "https://pje1g.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam" },
  trf1_araguaina: { url: "https://pje1g.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam" },
  trf1_balsas: { url: "https://pje1g.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam" },
  trf1_imperatriz: { url: "https://pje1g.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam" },
  trf1_palmas: { url: "https://pje1g.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam" },
  trf1_gurupi: { url: "https://pje1g.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam" },
  tse_local_votacao: { url: "https://www.tse.jus.br/servicos-eleitorais/titulo-e-local-de-votacao/consulta-por-nome" },
  tse_certidao: { url: "https://www.tse.jus.br/servicos-eleitorais/certidoes/certidao-de-quitacao-eleitoral" },
};

async function capturarPagina(siteKey: string, cpf: string): Promise<Buffer> {
  const config = SITE_CONFIGS[siteKey];
  if (!config) {
    throw new Error(`Site ${siteKey} não configurado`);
  }

  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--single-process",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    await page.goto(config.url, {
      waitUntil: "networkidle2",
      timeout: 20000,
    }).catch(() => {
      return page.goto(config.url, { waitUntil: "load", timeout: 15000 });
    });

    await new Promise(r => setTimeout(r, 2000));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

router.post("/pesquisa/capturar-pagina", async (req, res) => {
  try {
    const { siteKey, cpf } = req.body as { siteKey: string; cpf: string };

    if (!siteKey || !SITE_CONFIGS[siteKey]) {
      res.status(400).json({ error: "Site não configurado para captura" });
      return;
    }

    req.log.info({ siteKey, cpf }, "Iniciando captura de pagina");
    const pdfBuffer = await capturarPagina(siteKey, cpf);

    const safeKey = siteKey.replace(/[^a-zA-Z0-9]/g, "_");
    const safeCpf = cpf.replace(/\D/g, "");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="captura_${safeKey}_${safeCpf}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    req.log.error(err, "Erro ao capturar pagina");
    res.status(500).json({ error: "Erro ao capturar página" });
  }
});

router.post("/pesquisa/capturar-todas", async (req, res) => {
  try {
    const { cpf, sites } = req.body as { cpf: string; sites: string[] };

    if (!sites || sites.length === 0) {
      res.status(400).json({ error: "Nenhum site informado" });
      return;
    }

    const browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-extensions",
        "--single-process",
      ],
    });

    const capturas: Buffer[] = [];

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });

      for (const siteKey of sites) {
        const config = SITE_CONFIGS[siteKey];
        if (!config) continue;

        try {
          req.log.info({ siteKey }, "Capturando pagina");
          await page.goto(config.url, { waitUntil: "networkidle2", timeout: 20000 }).catch(() => {
            return page.goto(config.url, { waitUntil: "load", timeout: 15000 });
          });
          await new Promise(r => setTimeout(r, 2000));

          const headerHtml = `<div style="font-size:10px;font-family:Arial;color:#333;padding:5px 10mm;border-bottom:1px solid #ccc;"><b>Fonte: ${siteKey.toUpperCase().replace(/_/g, " ")}</b> | CPF: ${cpf} | ${new Date().toLocaleDateString("pt-BR")}</div>`;

          const pdfBuf = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "25mm", bottom: "10mm", left: "10mm", right: "10mm" },
            displayHeaderFooter: true,
            headerTemplate: headerHtml,
            footerTemplate: '<div style="font-size:8px;text-align:center;width:100%;color:#999;">Promarcos - Mendes Advocacia | Página <span class="pageNumber"></span></div>',
          });
          capturas.push(Buffer.from(pdfBuf));
        } catch {
          req.log.warn({ siteKey }, "Falha ao capturar pagina");
        }
      }
    } finally {
      await browser.close();
    }

    if (capturas.length === 0) {
      res.status(500).json({ error: "Nenhuma página capturada" });
      return;
    }

    const safeCpf = cpf.replace(/\D/g, "");

    if (capturas.length === 1) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="capturas_${safeCpf}.pdf"`);
      res.send(capturas[0]);
      return;
    }

    const { PDFDocument: PDFLibDoc } = await import("pdf-lib");

    const mergedPdf = await PDFLibDoc.create();
    for (const buf of capturas) {
      try {
        const srcPdf = await PDFLibDoc.load(buf);
        const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
        for (const p of pages) {
          mergedPdf.addPage(p);
        }
      } catch {
        req.log.warn("Falha ao merge de um PDF capturado");
      }
    }

    const mergedBuf = await mergedPdf.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="capturas_${safeCpf}.pdf"`);
    res.send(Buffer.from(mergedBuf));
  } catch (err) {
    req.log.error(err, "Erro ao capturar todas as paginas");
    res.status(500).json({ error: "Erro ao capturar páginas" });
  }
});

export default router;
