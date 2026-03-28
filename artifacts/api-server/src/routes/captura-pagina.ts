import { Router, type IRouter } from "express";
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import puppeteerCore from "puppeteer-core";

puppeteerExtra.use(StealthPlugin());

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
  pje_trf1: { url: PJE_TRF1_URL, automacao: "pje_trf1" },
  trf1_secao_to: { url: "https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TO", automacao: "trf1_processual" },
  trf1_araguaina: { url: "https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TO&subsecao=ARAGUAINA", automacao: "trf1_processual" },
  trf1_balsas: { url: "https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=MA&subsecao=BALSAS", automacao: "trf1_processual" },
  trf1_imperatriz: { url: "https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=MA&subsecao=IMPERATRIZ", automacao: "trf1_processual" },
  trf1_palmas: { url: "https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TO&subsecao=PALMAS", automacao: "trf1_processual" },
  trf1_gurupi: { url: "https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TO&subsecao=GURUPI", automacao: "trf1_processual" },
  tse_local_votacao: { url: "https://www.tse.jus.br/servicos-eleitorais/titulo-e-local-de-votacao/consulta-por-nome" },
  tse_certidao: { url: "https://www.tse.jus.br/servicos-eleitorais/certidoes/certidao-de-quitacao-eleitoral" },
};

function formatCpfDots(cpf: string): string {
  const nums = cpf.replace(/\D/g, "");
  if (nums.length !== 11) return nums;
  return `${nums.slice(0,3)}.${nums.slice(3,6)}.${nums.slice(6,9)}-${nums.slice(9)}`;
}

async function automacaoPjeTrf1(page: import("puppeteer-core").Page, cpf: string): Promise<void> {
  const cpfFormatado = formatCpfDots(cpf);
  const cpfSoNumeros = cpf.replace(/\D/g, "");

  await new Promise(r => setTimeout(r, 2000));

  await page.evaluate(() => {
    const radios = document.querySelectorAll('input[type="radio"]');
    for (const r of radios) {
      const radio = r as HTMLInputElement;
      if (radio.value === "CPF") {
        radio.click();
        return;
      }
      const label = radio.parentElement?.textContent || "";
      const forLabel = radio.id ? document.querySelector(`label[for="${radio.id}"]`)?.textContent || "" : "";
      if (/\bCPF\b/.test(label) || /\bCPF\b/.test(forLabel)) {
        radio.click();
        return;
      }
    }
    const labels = document.querySelectorAll('label');
    for (const l of labels) {
      if (/\bCPF\b/.test(l.textContent || "") && !/CNPJ/.test(l.textContent || "")) {
        l.click();
        return;
      }
    }
  });
  await new Promise(r => setTimeout(r, 500));

  await page.evaluate((cpfDots: string, cpfNums: string) => {
    const selectors = [
      'input[id$="pesquisarDocumento:cpfCnpj"]',
      'input[id$="cpfCnpj"]',
      'input[name*="cpf"]',
      'input[name*="Cpf"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.value = cpfDots;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
        return;
      }
    }
    const inputs = document.querySelectorAll('input[type="text"]');
    for (const inp of inputs) {
      const input = inp as HTMLInputElement;
      const id = input.id || "";
      const name = input.name || "";
      const placeholder = input.placeholder || "";
      if (/cpf|cnpj/i.test(id) || /cpf|cnpj/i.test(name) || /cpf|cnpj/i.test(placeholder)) {
        input.focus();
        input.value = cpfDots;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("blur", { bubbles: true }));
        return;
      }
    }
  }, cpfFormatado, cpfSoNumeros);

  await new Promise(r => setTimeout(r, 1000));

  const pesquisarBtn = await page.$('input[id$="pesquisarDocumento:btnPesquisar"]');
  if (pesquisarBtn) {
    await pesquisarBtn.click();
  } else {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('input[type="submit"], input[type="button"], button'));
      for (const btn of btns) {
        const val = btn instanceof HTMLInputElement ? btn.value : btn.textContent || "";
        if (val.toUpperCase().includes("PESQUISAR")) {
          (btn as HTMLElement).click();
          return;
        }
      }
    });
  }

  await new Promise(r => setTimeout(r, 7000));

  await page.waitForSelector('.rich-table, .rf-dt, .resultados, .alert, .rich-panel, table.list', { timeout: 15000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 3000));

  await page.evaluate(async () => {
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    let prev = 0;
    let curr = document.body.scrollHeight;
    while (curr !== prev) {
      window.scrollTo(0, curr);
      await delay(500);
      prev = curr;
      curr = document.body.scrollHeight;
    }
    window.scrollTo(0, 0);
  });
  await new Promise(r => setTimeout(r, 1000));
}

async function waitForCloudflare(page: import("puppeteer-core").Page): Promise<boolean> {
  const maxWait = 20000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const isChallenge = await page.evaluate(() => {
      const body = document.body?.innerText || "";
      return body.includes("Verify you are human") ||
             body.includes("Performing security verification") ||
             body.includes("Just a moment") ||
             !!document.querySelector('#challenge-running, #challenge-stage, .cf-browser-verification');
    });
    if (!isChallenge) return true;
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

async function automacaoTrf1Processual(page: import("puppeteer-core").Page, cpf: string): Promise<void> {
  await waitForCloudflare(page);

  const cpfSoNumeros = cpf.replace(/\D/g, "");

  await page.waitForSelector('input[name="txtCPFCNPJ"], input[name="cpfCnpj"], input[type="text"]', { timeout: 15000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1000));

  await page.evaluate((cpfVal: string) => {
    const selectors = [
      'input[name="txtCPFCNPJ"]',
      'input[name="cpfCnpj"]',
      'input[name="numCPF"]',
      '#txtCPFCNPJ',
    ];
    let found = false;
    for (const sel of selectors) {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.value = cpfVal;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        found = true;
        break;
      }
    }
    if (!found) {
      const inputs = document.querySelectorAll('input[type="text"]');
      for (const inp of inputs) {
        const input = inp as HTMLInputElement;
        const label = input.previousElementSibling?.textContent || "";
        const placeholder = input.placeholder || "";
        const name = input.name || "";
        if (/cpf|cnpj/i.test(label) || /cpf|cnpj/i.test(placeholder) || /cpf|cnpj/i.test(name)) {
          input.focus();
          input.value = cpfVal;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          break;
        }
      }
    }

    const chkBaixados = document.querySelector('input[name="chkMostrarBaixados"], input[type="checkbox"]') as HTMLInputElement | null;
    if (chkBaixados && !chkBaixados.checked) {
      chkBaixados.click();
    }
  }, cpfSoNumeros);

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
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => null);
    await new Promise(r => setTimeout(r, 3000));
    await page.waitForSelector('table, .resultado, .listagem, .alert, #divResultado, .tabelaLista', { timeout: 10000 }).catch(() => null);
    await new Promise(r => setTimeout(r, 2000));
  }

  await page.evaluate(async () => {
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    let prev = 0;
    let curr = document.body.scrollHeight;
    while (curr !== prev) {
      window.scrollTo(0, curr);
      await delay(500);
      prev = curr;
      curr = document.body.scrollHeight;
    }
    window.scrollTo(0, 0);
  });
  await new Promise(r => setTimeout(r, 1000));
}

async function capturarPagina(siteKey: string, cpf: string): Promise<Buffer> {
  const config = SITE_CONFIGS[siteKey];
  if (!config) {
    throw new Error(`Site ${siteKey} não configurado`);
  }

  const browser = await puppeteerExtra.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: CHROMIUM_ARGS,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

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

    const pdfOptions: Parameters<typeof page.pdf>[0] = {
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    };

    if (config.automacao === "pje_trf1" || config.automacao === "trf1_processual") {
      const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
      pdfOptions.width = "1280px";
      pdfOptions.height = `${bodyHeight + 40}px`;
    } else {
      pdfOptions.format = "A4";
    }

    const pdfBuffer = await page.pdf(pdfOptions);

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

    const browser = await puppeteerExtra.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: CHROMIUM_ARGS,
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

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

      const dataAtual = new Date().toLocaleDateString("pt-BR") + ", " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const pageUrl = await page.url();

      const consultaPdfOptions: Parameters<typeof page.pdf>[0] = {
        printBackground: true,
        margin: { top: "20mm", bottom: "15mm", left: "10mm", right: "10mm" },
        displayHeaderFooter: true,
        headerTemplate: `<div style="font-size:9px;font-family:Arial,sans-serif;color:#555;width:100%;padding:0 15mm;display:flex;justify-content:space-between;"><span>${dataAtual}</span><span style="max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${pageUrl}</span></div>`,
        footerTemplate: `<div style="font-size:9px;font-family:Arial,sans-serif;color:#555;width:100%;padding:0 15mm;display:flex;justify-content:space-between;"><span>${pageUrl}</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`,
      };

      if (config.automacao === "pje_trf1" || config.automacao === "trf1_processual") {
        const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
        consultaPdfOptions.width = "1280px";
        consultaPdfOptions.height = `${bodyHeight + 40}px`;
      } else {
        consultaPdfOptions.format = "A4";
      }

      const pdfBuffer = await page.pdf(consultaPdfOptions);

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

    const browser = await puppeteerExtra.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: CHROMIUM_ARGS,
    });

    const capturas: Buffer[] = [];

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

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

          const todasPdfOpts: Parameters<typeof page.pdf>[0] = {
            printBackground: true,
            margin: { top: "25mm", bottom: "10mm", left: "10mm", right: "10mm" },
            displayHeaderFooter: true,
            headerTemplate: headerHtml,
            footerTemplate: '<div style="font-size:8px;text-align:center;width:100%;color:#999;">Promarcos - Mendes Advocacia | Página <span class="pageNumber"></span></div>',
          };

          if (config.automacao === "pje_trf1" || config.automacao === "trf1_processual") {
            const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
            todasPdfOpts.width = "1280px";
            todasPdfOpts.height = `${bodyHeight + 40}px`;
          } else {
            todasPdfOpts.format = "A4";
          }

          const pdfBuf = await page.pdf(todasPdfOpts);
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
