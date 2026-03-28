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
  automacao?: "pje_trf1" | "trf1_processual" | "tse_certidao";
}

interface DadosPesquisa {
  cpf: string;
  nome?: string;
  dataNascimento?: string;
  nomeMae?: string;
  nomePai?: string;
}

const PJE_TRF1_URL = "https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam";

const SITE_CONFIGS: Record<string, SiteConfig> = {
  pje_trf1: { url: PJE_TRF1_URL, automacao: "pje_trf1" },
  trf1_secao_to: { url: "https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TO", automacao: "trf1_processual" },
  trf1_araguaina: { url: "https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TO&subsecao=ARAGUAINA", automacao: "trf1_processual" },
  trf1_balsas: { url: "https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=MA&subsecao=BALSAS", automacao: "trf1_processual" },
  trf1_imperatriz: { url: "https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=MA&subsecao=IMPERATRIZ", automacao: "trf1_processual" },
  trf1_palmas: { url: "https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TO&subsecao=PALMAS", automacao: "trf1_processual" },
  trf1_gurupi: { url: "https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TO&subsecao=GURUPI", automacao: "trf1_processual" },
  tse_certidao: { url: "https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral#/certidoes-eleitor", automacao: "tse_certidao" },
};

function formatCpfDots(cpf: string): string {
  const nums = cpf.replace(/\D/g, "");
  if (nums.length !== 11) return nums;
  return `${nums.slice(0,3)}.${nums.slice(3,6)}.${nums.slice(6,9)}-${nums.slice(9)}`;
}

async function automacaoPjeTrf1(page: import("puppeteer-core").Page, cpf: string): Promise<void> {
  const cpfFormatado = formatCpfDots(cpf);

  await new Promise(r => setTimeout(r, 3000));

  const cpfInputSel = 'input[id="fPP:dpDec:documentoParte"]';
  await page.waitForSelector(cpfInputSel, { timeout: 10000 }).catch(() => null);

  const cpfInput = await page.$(cpfInputSel);
  if (cpfInput) {
    await cpfInput.click({ clickCount: 3 });
    await new Promise(r => setTimeout(r, 200));
    await cpfInput.type(cpfFormatado, { delay: 50 });
  } else {
    await page.evaluate((cpfVal: string) => {
      const el = document.querySelector('input[id$="documentoParte"]') as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.value = cpfVal;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }, cpfFormatado);
  }

  await new Promise(r => setTimeout(r, 1000));

  const pesquisarBtn = await page.$('input[id="fPP:searchProcessos"]');
  if (pesquisarBtn) {
    await pesquisarBtn.click();
  } else {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
      for (const btn of btns) {
        const val = btn instanceof HTMLInputElement ? btn.value : btn.textContent || "";
        if (val.toUpperCase().includes("PESQUISAR")) {
          (btn as HTMLElement).click();
          return;
        }
      }
    });
  }

  await new Promise(r => setTimeout(r, 8000));

  await page.waitForSelector('.rich-table, .rf-dt, .resultados, .rich-panel, table.list, .listView, div[id$="resultados"]', { timeout: 15000 }).catch(() => null);
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

async function automacaoTseCertidao(page: import("puppeteer-core").Page, dados: DadosPesquisa): Promise<void> {
  const cpfFormatado = formatCpfDots(dados.cpf);

  console.log("[TSE] Waiting for Angular SPA to bootstrap...");
  await new Promise(r => setTimeout(r, 10000));

  const appRootHtml = await page.evaluate(() => {
    const appRoot = document.querySelector('app-root');
    if (appRoot) {
      return {
        html: appRoot.innerHTML.substring(0, 5000),
        textContent: appRoot.textContent?.substring(0, 1000) || "",
        childCount: appRoot.children.length,
      };
    }
    return { html: "NO APP ROOT", textContent: "", childCount: 0 };
  });
  console.log("[TSE] app-root children:", appRootHtml.childCount, "textLen:", appRootHtml.textContent.length);

  const pageHasCaptcha = await page.evaluate(() => {
    const hcaptcha = document.querySelector('.h-captcha, [data-hcaptcha-widget-id], #hcaptcha, .hcaptcha-box');
    const iframe = document.querySelector('iframe[src*="hcaptcha"]');
    return { hasCaptchaDiv: !!hcaptcha, hasCaptchaIframe: !!iframe };
  });
  const formVisible = await page.evaluate(() => {
    return document.body.innerText.includes("Nome do eleitor") || document.body.innerText.includes("Autenticação");
  });

  if (!formVisible) {
    console.log("[TSE] Form not visible, clicking Certidão de Quitação...");

    await page.evaluate(() => {
      const allEls = document.querySelectorAll('a, li, span, div, button, h3, h4, p');
      for (const el of allEls) {
        const ownText = Array.from(el.childNodes)
          .filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => n.textContent?.trim())
          .join(" ");
        const fullText = (el.textContent || "").trim();
        if (
          (ownText && /certid.o de quita..o/i.test(ownText)) ||
          (fullText.length < 80 && /1\.\s*certid.o de quita..o/i.test(fullText))
        ) {
          (el as HTMLElement).click();
          return el.tagName + ": " + fullText.substring(0, 50);
        }
      }
      return "NOT FOUND";
    });
    await new Promise(r => setTimeout(r, 5000));
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const found = await page.evaluate(() => {
      return document.body.innerText.includes("Nome do eleitor") ||
        document.body.innerText.includes("Autenticação") ||
        document.querySelector('input[placeholder*="eleitor"]') !== null;
    });
    if (found) {
      console.log(`[TSE] Form appeared after ${attempt} waits`);
      break;
    }
    if (attempt === 3) {
      console.log("[TSE] Retry: re-clicking certidão link...");
      await page.evaluate(() => {
        const els = document.querySelectorAll('*');
        for (const el of els) {
          const t = (el.textContent || "").trim();
          if (el.children.length <= 3 && t.length < 100 && /certid.o de quita..o/i.test(t)) {
            (el as HTMLElement).click();
            return;
          }
        }
      });
    }
    if (attempt === 5) {
      console.log("[TSE] Retry: navigating directly to certidoes-eleitor...");
      await page.goto("https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral#/certidoes-eleitor", {
        waitUntil: "networkidle2",
        timeout: 20000,
      }).catch(() => null);
      await new Promise(r => setTimeout(r, 8000));
    }
    console.log(`[TSE] Wait ${attempt + 1}/8 for form...`);
    await new Promise(r => setTimeout(r, 3000));
  }

  const allInputsDebug = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    const info: string[] = [];
    inputs.forEach((inp, i) => {
      if (inp.type !== "hidden" && inp.type !== "radio" && inp.type !== "checkbox") {
        info.push(`input[${i}]: ph="${inp.placeholder}" type="${inp.type}" id="${inp.id}" visible=${inp.offsetHeight > 0}`);
      }
    });
    return info;
  });
  console.log("[TSE] All text inputs:", JSON.stringify(allInputsDebug));

  async function fillByPlaceholder(placeholderPart: string, value: string): Promise<boolean> {
    const selector = `input[placeholder*="${placeholderPart}" i]`;
    const el = await page.$(selector);
    if (el) {
      await el.click({ clickCount: 3 });
      await new Promise(r => setTimeout(r, 200));
      await el.press("Backspace");
      await el.type(value, { delay: 40 });
      await new Promise(r => setTimeout(r, 300));
      console.log(`[TSE] Filled "${placeholderPart}" with "${value}"`);
      return true;
    }

    const filled = await page.evaluate((ph: string, val: string) => {
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        if (inp.placeholder && inp.placeholder.toLowerCase().includes(ph.toLowerCase())) {
          inp.focus();
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(inp, val);
          else inp.value = val;
          inp.dispatchEvent(new Event("input", { bubbles: true }));
          inp.dispatchEvent(new Event("change", { bubbles: true }));
          inp.dispatchEvent(new Event("blur", { bubbles: true }));
          return true;
        }
      }

      const labels = document.querySelectorAll('label, .form-label, mat-label');
      for (const lbl of labels) {
        if ((lbl.textContent || "").toLowerCase().includes(ph.toLowerCase())) {
          const parent = lbl.closest('.form-group, .mat-form-field, .form-control, div');
          if (parent) {
            const inp = parent.querySelector('input') as HTMLInputElement;
            if (inp) {
              inp.focus();
              inp.value = val;
              inp.dispatchEvent(new Event("input", { bubbles: true }));
              inp.dispatchEvent(new Event("change", { bubbles: true }));
              inp.dispatchEvent(new Event("blur", { bubbles: true }));
              return true;
            }
          }
        }
      }
      return false;
    }, placeholderPart, value);
    
    console.log(`[TSE] fillByPlaceholder("${placeholderPart}") => ${filled ? "OK" : "NOT FOUND"}`);
    return filled;
  }

  if (dados.nome) {
    await fillByPlaceholder("Nome do eleitor", dados.nome);
  }

  await fillByPlaceholder("tulo eleitoral ou CPF", cpfFormatado);

  if (dados.dataNascimento) {
    await fillByPlaceholder("Data de nascimento", dados.dataNascimento);
  }

  const selectResult = await page.evaluate(() => {
    const selects = document.querySelectorAll('select');
    for (const sel of selects) {
      for (const opt of sel.options) {
        const text = opt.text.toUpperCase();
        if (text.includes("MÃE") || text.includes("MAE")) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          sel.dispatchEvent(new Event("input", { bubbles: true }));
          return `Selected: ${opt.text}`;
        }
      }
    }
    return "No select found";
  });
  console.log("[TSE] Select:", selectResult);
  await new Promise(r => setTimeout(r, 2000));

  if (dados.nomeMae) {
    const maeOk = await fillByPlaceholder("Nome da m", dados.nomeMae);
    if (!maeOk) await fillByPlaceholder("mae", dados.nomeMae);
  }

  if (dados.nomePai) {
    const paiOk = await fillByPlaceholder("Nome do pai", dados.nomePai);
    if (!paiOk) await fillByPlaceholder("pai", dados.nomePai);
  }

  await new Promise(r => setTimeout(r, 1000));

  const afterFill = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    const vals: string[] = [];
    inputs.forEach((inp, i) => {
      if (inp.type !== "hidden" && inp.type !== "radio" && inp.type !== "checkbox" && inp.offsetHeight > 0) {
        vals.push(`[${i}] ph="${inp.placeholder}" val="${inp.value}"`);
      }
    });
    return vals;
  });
  console.log("[TSE] After fill:", JSON.stringify(afterFill));

  const clicked = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      const text = (btn.textContent || "").trim();
      if (/^entrar$/i.test(text)) {
        btn.click();
        return `Clicked: ${text}`;
      }
    }
    return "No Entrar button found";
  });
  console.log("[TSE] Button:", clicked);

  await new Promise(r => setTimeout(r, 15000));

  const resultText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
  console.log("[TSE] Result:", resultText.substring(0, 500));

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
  await new Promise(r => setTimeout(r, 2000));
}

async function capturarPagina(siteKey: string, cpf: string, dados?: DadosPesquisa): Promise<Buffer> {
  const config = SITE_CONFIGS[siteKey];
  if (!config) {
    throw new Error(`Site ${siteKey} não configurado`);
  }

  const browser = await puppeteerExtra.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: CHROMIUM_ARGS,
    protocolTimeout: 120000,
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
    } else if (config.automacao === "tse_certidao" && dados) {
      await automacaoTseCertidao(page, dados);
    }

    const pdfOptions: Parameters<typeof page.pdf>[0] = {
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    };

    if (config.automacao === "pje_trf1" || config.automacao === "trf1_processual" || config.automacao === "tse_certidao") {
      const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
      pdfOptions.width = "1280px";
      pdfOptions.height = `${Math.max(bodyHeight + 40, 900)}px`;
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
    const { siteKey, cpf, nome, dataNascimento, nomeMae, nomePai } = req.body as { siteKey: string; cpf: string; nome?: string; dataNascimento?: string; nomeMae?: string; nomePai?: string };

    if (!siteKey || !SITE_CONFIGS[siteKey]) {
      res.json({ siteKey, encontrado: false, mensagem: "Site não configurado", pdf: null });
      return;
    }

    const config = SITE_CONFIGS[siteKey];
    const dados: DadosPesquisa = { cpf, nome, dataNascimento, nomeMae, nomePai };
    req.log.info({ siteKey, cpf }, "Consultando site com captura");

    const browser = await puppeteerExtra.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: CHROMIUM_ARGS,
      protocolTimeout: 120000,
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
      } else if (config.automacao === "tse_certidao") {
        await automacaoTseCertidao(page, dados);
      }

      const pageText = await page.evaluate(() => document.body?.innerText || "");

      let semResultado: boolean;
      if (config.automacao === "pje_trf1") {
        const matchResultados = pageText.match(/(\d+)\s*resultados?\s*encontrados?/i);
        if (matchResultados) {
          semResultado = parseInt(matchResultados[1], 10) === 0;
        } else {
          semResultado = /nenhum (resultado|processo|registro)/i.test(pageText)
            || /sua pesquisa não encontrou/i.test(pageText);
        }
      } else {
        semResultado = /nenhum (resultado|processo|registro|dado)/i.test(pageText)
          || /não (encontr|retorn)/i.test(pageText)
          || /sua pesquisa não encontrou/i.test(pageText)
          || /0 resultados? encontrados?/i.test(pageText);
      }

      const dataAtual = new Date().toLocaleDateString("pt-BR") + ", " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const pageUrl = await page.url();

      const consultaPdfOptions: Parameters<typeof page.pdf>[0] = {
        printBackground: true,
        margin: { top: "20mm", bottom: "15mm", left: "10mm", right: "10mm" },
        displayHeaderFooter: true,
        headerTemplate: `<div style="font-size:9px;font-family:Arial,sans-serif;color:#555;width:100%;padding:0 15mm;display:flex;justify-content:space-between;"><span>${dataAtual}</span><span style="max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${pageUrl}</span></div>`,
        footerTemplate: `<div style="font-size:9px;font-family:Arial,sans-serif;color:#555;width:100%;padding:0 15mm;display:flex;justify-content:space-between;"><span>${pageUrl}</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`,
      };

      if (config.automacao === "pje_trf1" || config.automacao === "trf1_processual" || config.automacao === "tse_certidao") {
        const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
        consultaPdfOptions.width = "1280px";
        consultaPdfOptions.height = `${Math.max(bodyHeight + 40, 900)}px`;
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
    const { siteKey, cpf, nome, dataNascimento, nomeMae, nomePai } = req.body as { siteKey: string; cpf: string; nome?: string; dataNascimento?: string; nomeMae?: string; nomePai?: string };

    if (!siteKey || !SITE_CONFIGS[siteKey]) {
      res.status(400).json({ error: "Site não configurado para captura" });
      return;
    }

    const dados: DadosPesquisa = { cpf, nome, dataNascimento, nomeMae, nomePai };
    req.log.info({ siteKey, cpf }, "Iniciando captura de pagina");
    const pdfBuffer = await capturarPagina(siteKey, cpf, dados);

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
    const { cpf, sites, nome, dataNascimento, nomeMae, nomePai } = req.body as { cpf: string; sites: string[]; nome?: string; dataNascimento?: string; nomeMae?: string; nomePai?: string };

    if (!sites || sites.length === 0) {
      res.status(400).json({ error: "Nenhum site informado" });
      return;
    }

    const dados: DadosPesquisa = { cpf, nome, dataNascimento, nomeMae, nomePai };

    const browser = await puppeteerExtra.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: CHROMIUM_ARGS,
      protocolTimeout: 120000,
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
          } else if (config.automacao === "tse_certidao") {
            await automacaoTseCertidao(page, dados);
          }

          const headerHtml = `<div style="font-size:10px;font-family:Arial;color:#333;padding:5px 10mm;border-bottom:1px solid #ccc;"><b>Fonte: ${siteKey.toUpperCase().replace(/_/g, " ")}</b> | CPF: ${cpf} | ${new Date().toLocaleDateString("pt-BR")}</div>`;

          const todasPdfOpts: Parameters<typeof page.pdf>[0] = {
            printBackground: true,
            margin: { top: "25mm", bottom: "10mm", left: "10mm", right: "10mm" },
            displayHeaderFooter: true,
            headerTemplate: headerHtml,
            footerTemplate: '<div style="font-size:8px;text-align:center;width:100%;color:#999;">Promarcos - Mendes Advocacia | Página <span class="pageNumber"></span></div>',
          };

          if (config.automacao === "pje_trf1" || config.automacao === "trf1_processual" || config.automacao === "tse_certidao") {
            const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
            todasPdfOpts.width = "1280px";
            todasPdfOpts.height = `${Math.max(bodyHeight + 40, 900)}px`;
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
