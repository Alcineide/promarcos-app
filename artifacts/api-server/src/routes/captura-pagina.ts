import { Router, type IRouter } from "express";
import puppeteer from "puppeteer-core";

const router: IRouter = Router();

import { execSync } from "child_process";
import { existsSync, accessSync, constants } from "fs";

function findChromium(): string {
  if (process.env.CHROMIUM_PATH) {
    const envPath = process.env.CHROMIUM_PATH;
    try {
      accessSync(envPath, constants.X_OK);
      return envPath;
    } catch { /* env path not executable */ }
  }

  const candidates = [
    "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium",
  ];

  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) {
        accessSync(candidate, constants.X_OK);
        return candidate;
      }
    } catch { /* not executable */ }
  }

  const whichCmds = ["which chromium", "which chromium-browser", "which google-chrome"];
  for (const cmd of whichCmds) {
    try {
      const found = execSync(`${cmd} 2>/dev/null`, { encoding: "utf-8" }).trim();
      if (found && existsSync(found)) {
        accessSync(found, constants.X_OK);
        return found;
      }
    } catch { /* not found */ }
  }

  console.error("WARNING: No Chromium executable found. PDF capture will fail.");
  return candidates[0];
}

const CHROMIUM_PATH = findChromium();
console.log(`Chromium path resolved: ${CHROMIUM_PATH}`);

const CHROMIUM_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-software-rasterizer",
  "--disable-background-networking",
  "--disable-default-apps",
  "--disable-translate",
  "--no-first-run",
  "--disable-features=VizDisplayCompositor",
];

interface SiteConfig {
  url: string;
  automacao?: "pje_trf1" | "trf1_processual";
}

const PJE_TRF1_URL = "https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam";

const SITE_CONFIGS: Record<string, SiteConfig> = {
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
  pje_trf1: { url: PJE_TRF1_URL, automacao: "pje_trf1" },
  trf1_secao_to: { url: "https://processual.trf1.jus.br/consultaProcessual/consultaProcessual.php?secao=TO", automacao: "trf1_processual" },
  trf1_araguaina: { url: "https://processual.trf1.jus.br/consultaProcessual/consultaProcessual.php?secao=TO&subsecao=ARAGUAINA", automacao: "trf1_processual" },
  trf1_balsas: { url: "https://processual.trf1.jus.br/consultaProcessual/consultaProcessual.php?secao=MA&subsecao=BALSAS", automacao: "trf1_processual" },
  trf1_imperatriz: { url: "https://processual.trf1.jus.br/consultaProcessual/consultaProcessual.php?secao=MA&subsecao=IMPERATRIZ", automacao: "trf1_processual" },
  trf1_palmas: { url: "https://processual.trf1.jus.br/consultaProcessual/consultaProcessual.php?secao=TO&subsecao=PALMAS", automacao: "trf1_processual" },
  trf1_gurupi: { url: "https://processual.trf1.jus.br/consultaProcessual/consultaProcessual.php?secao=TO&subsecao=GURUPI", automacao: "trf1_processual" },
  tse_local_votacao: { url: "https://www.tse.jus.br/servicos-eleitorais/titulo-e-local-de-votacao/consulta-por-nome" },
  tse_certidao: { url: "https://www.tse.jus.br/servicos-eleitorais/certidoes/certidao-de-quitacao-eleitoral" },
};

function formatCpfDots(cpf: string): string {
  const nums = cpf.replace(/\D/g, "");
  if (nums.length !== 11) return nums;
  return `${nums.slice(0,3)}.${nums.slice(3,6)}.${nums.slice(6,9)}-${nums.slice(9)}`;
}

async function automacaoPjeTrf1(page: import("puppeteer-core").Page, cpf: string): Promise<void> {
  await page.waitForSelector('input[id$="pesquisarDocumento:cpfCnpj"]', { timeout: 10000 }).catch(() => null);

  const cpfFormatado = formatCpfDots(cpf);

  await page.evaluate((cpfVal: string) => {
    const cpfInput = document.querySelector('input[id$="pesquisarDocumento:cpfCnpj"]') as HTMLInputElement | null;
    if (cpfInput) {
      cpfInput.value = cpfVal;
      cpfInput.dispatchEvent(new Event("input", { bubbles: true }));
      cpfInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, cpfFormatado);

  await new Promise(r => setTimeout(r, 500));

  const pesquisarBtn = await page.$('input[id$="pesquisarDocumento:btnPesquisar"]');
  if (pesquisarBtn) {
    await pesquisarBtn.click();
  } else {
    const allBtns = await page.$$('input[type="submit"], input[type="button"], button');
    for (const btn of allBtns) {
      const val = await page.evaluate((el: Element) => {
        if (el instanceof HTMLInputElement) return el.value;
        return el.textContent || "";
      }, btn);
      if (val && val.toUpperCase().includes("PESQUISAR")) {
        await btn.click();
        break;
      }
    }
  }

  await new Promise(r => setTimeout(r, 5000));

  await page.waitForSelector('.rich-table, .rf-dt, .resultados, .alert, .rich-panel', { timeout: 10000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 2000));
}

async function automacaoTrf1Processual(page: import("puppeteer-core").Page, cpf: string): Promise<void> {
  await page.waitForSelector('input[name="txtCPFCNPJ"], input[name="numCPF"], input[name="cpfCnpj"], #txtCPFCNPJ', { timeout: 10000 }).catch(() => null);

  const cpfFormatado = formatCpfDots(cpf);

  await page.evaluate((cpfVal: string) => {
    const possibleSelectors = [
      'input[name="txtCPFCNPJ"]',
      'input[name="numCPF"]',
      'input[name="cpfCnpj"]',
      '#txtCPFCNPJ',
      'input[name="cpf"]',
    ];
    for (const sel of possibleSelectors) {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      if (el) {
        el.value = cpfVal;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        break;
      }
    }
  }, cpfFormatado);

  await new Promise(r => setTimeout(r, 500));

  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('input[type="submit"], input[type="button"], button'));
    for (const btn of btns) {
      const val = btn instanceof HTMLInputElement ? btn.value : btn.textContent || "";
      if (val.toUpperCase().includes("PESQUIS") || val.toUpperCase().includes("CONSULTAR") || val.toUpperCase().includes("BUSCAR")) {
        (btn as HTMLElement).click();
        return true;
      }
    }
    const form = document.querySelector("form");
    if (form) { form.submit(); return true; }
    return false;
  });

  if (clicked) {
    await new Promise(r => setTimeout(r, 5000));
    await page.waitForSelector('table, .resultado, .listagem, .alert, #divResultado', { timeout: 10000 }).catch(() => null);
    await new Promise(r => setTimeout(r, 2000));
  }
}

async function capturarPagina(siteKey: string, cpf: string): Promise<Buffer> {
  const config = SITE_CONFIGS[siteKey];
  if (!config) {
    throw new Error(`Site ${siteKey} não configurado`);
  }

  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: CHROMIUM_ARGS,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    await page.goto(config.url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    }).catch(() => {
      return page.goto(config.url, { waitUntil: "load", timeout: 20000 });
    });

    await new Promise(r => setTimeout(r, 3000));

    if (config.automacao === "pje_trf1") {
      await automacaoPjeTrf1(page, cpf);
    } else if (config.automacao === "trf1_processual") {
      await automacaoTrf1Processual(page, cpf);
    }

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

router.post("/pesquisa/consultar-site", async (req, res) => {
  try {
    const { siteKey, cpf } = req.body as { siteKey: string; cpf: string };

    if (!siteKey || !SITE_CONFIGS[siteKey]) {
      res.json({ siteKey, encontrado: false, mensagem: "Site não configurado", pdf: null });
      return;
    }

    const config = SITE_CONFIGS[siteKey];
    req.log.info({ siteKey, cpf }, "Consultando site com captura");

    const browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: CHROMIUM_ARGS,
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });

      await page.goto(config.url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      }).catch(() => {
        return page.goto(config.url, { waitUntil: "load", timeout: 20000 });
      });

      await new Promise(r => setTimeout(r, 3000));

      if (config.automacao === "pje_trf1") {
        await automacaoPjeTrf1(page, cpf);
      } else if (config.automacao === "trf1_processual") {
        await automacaoTrf1Processual(page, cpf);
      }

      const pageText = await page.evaluate(() => document.body?.innerText || "");

      const semResultado = /nenhum (resultado|processo|registro|dado)/i.test(pageText)
        || /não (encontr|retorn)/i.test(pageText)
        || /sua pesquisa não encontrou/i.test(pageText)
        || /0 resultados? encontrados?/i.test(pageText);

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
      });

      const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

      res.json({
        siteKey,
        encontrado: !semResultado,
        mensagem: semResultado ? "Nenhuma informação neste local" : "Página capturada com sucesso",
        pdf: pdfBase64,
      });
    } finally {
      await browser.close();
    }
  } catch (err) {
    req.log.error(err, "Erro ao consultar site");
    const siteKey = (req.body as { siteKey?: string }).siteKey || "";
    res.json({
      siteKey,
      encontrado: false,
      mensagem: "Site temporariamente indisponível",
      pdf: null,
    });
  }
});

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
      args: CHROMIUM_ARGS,
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

          if (config.automacao === "pje_trf1") {
            await automacaoPjeTrf1(page, cpf);
          } else if (config.automacao === "trf1_processual") {
            await automacaoTrf1Processual(page, cpf);
          }

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
