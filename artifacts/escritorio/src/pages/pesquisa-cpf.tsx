import { Layout } from "@/components/layout";
import { useState, useCallback } from "react";
import { PDFDocument } from "pdf-lib";
import { useOnlineStatus } from "@/hooks/use-online-status";

interface PesquisaResult {
  local: string;
  mensagem: string;
  dados?: Record<string, unknown>;
  baixando?: boolean;
  pdfBase64?: string;
  siteKey?: string;
}

const CONSULTAS = [
  { key: "pje_trf1", label: "PJE-TRF1", url: "https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam", descricao: "PJe TRF1 - Processos Eletrônicos (Novo)" },
  { key: "trf1_secao_to", label: "TRF1-SEÇÃO-TO", url: "https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TO", descricao: "TRF1 Seção Judiciária TO - Processos Físicos (Antigo)" },
  { key: "trf1_araguaina", label: "TRF1-ARAGUAÍNA", url: "https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TO&subsecao=ARAGUAINA", descricao: "TRF1 Subseção Araguaína - Processos Físicos (Antigo)" },
  { key: "trf1_balsas", label: "TRF1-BALSAS", url: "https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=MA&subsecao=BALSAS", descricao: "TRF1 Subseção Balsas - Processos Físicos (Antigo)" },
  { key: "trf1_imperatriz", label: "TRF1-IMPERATRIZ", url: "https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=MA&subsecao=IMPERATRIZ", descricao: "TRF1 Subseção Imperatriz - Processos Físicos (Antigo)" },
  { key: "trf1_palmas", label: "TRF1-PALMAS", url: "https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TO&subsecao=PALMAS", descricao: "TRF1 Subseção Palmas - Processos Físicos (Antigo)" },
  { key: "trf1_gurupi", label: "TRF1-GURUPI", url: "https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TO&subsecao=GURUPI", descricao: "TRF1 Subseção Gurupi - Processos Físicos (Antigo)" },
];

export default function PesquisaCpf() {
  const isOnline = useOnlineStatus();
  const [cpf, setCpf] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [resultados, setResultados] = useState<PesquisaResult[]>([]);
  const [pesquisando, setPesquisando] = useState(false);
  const [fonteAtual, setFonteAtual] = useState("");
  const [pesquisaFeita, setPesquisaFeita] = useState(false);
  const [erro, setErro] = useState("");

  function formatCpf(value: string) {
    const nums = value.replace(/\D/g, "").slice(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
    if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
    return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
  }

  function formatDate(value: string) {
    const nums = value.replace(/\D/g, "").slice(0, 8);
    if (nums.length <= 2) return nums;
    if (nums.length <= 4) return `${nums.slice(0, 2)}/${nums.slice(2)}`;
    return `${nums.slice(0, 2)}/${nums.slice(2, 4)}/${nums.slice(4)}`;
  }

  const handlePesquisar = useCallback(async () => {
    if (!navigator.onLine) {
      setErro("A pesquisa de litispendência requer conexão com a internet.");
      return;
    }
    const cpfNumerico = cpf.replace(/\D/g, "");
    if (cpfNumerico.length !== 11) {
      setErro("CPF deve ter 11 dígitos");
      return;
    }
    if (!dataNascimento || dataNascimento.replace(/\D/g, "").length !== 8) {
      setErro("Data de nascimento obrigatória");
      return;
    }
    setPesquisando(true);
    setPesquisaFeita(false);
    setErro("");
    setResultados([]);

    for (const consulta of CONSULTAS) {
      setFonteAtual(consulta.label);

      try {
        const res = await fetch("/api/pesquisa/consultar-site", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteKey: consulta.key, cpf: cpfNumerico, dataNascimento }),
        });
        if (res.ok) {
          const data = await res.json();
          setResultados((prev) => [...prev, {
            local: consulta.label,
            mensagem: data.mensagem || "Nenhuma informação neste local",
            pdfBase64: data.pdf || undefined,
            siteKey: consulta.key,
          }]);
        } else {
          setResultados((prev) => [...prev, {
            local: consulta.label,
            mensagem: "Nenhuma informação neste local",
            siteKey: consulta.key,
          }]);
        }
      } catch {
        setResultados((prev) => [...prev, {
          local: consulta.label,
          mensagem: "Site temporariamente indisponível",
          siteKey: consulta.key,
        }]);
      }
    }

    setFonteAtual("");
    setPesquisaFeita(true);
    setPesquisando(false);
  }, [cpf, dataNascimento]);

  function getSiteKey(label: string): string | null {
    const consulta = CONSULTAS.find(c => c.label === label);
    if (!consulta) return null;
    return consulta.key;
  }

  const [erroPdf, setErroPdf] = useState("");

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleBaixarPdf(index: number) {
    const r = resultados[index];
    setErroPdf("");

    if (r.pdfBase64) {
      const byteChars = atob(r.pdfBase64);
      const byteNumbers = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteNumbers], { type: "application/pdf" });
      downloadBlob(blob, `pesquisa_${r.local.replace(/[^a-zA-Z0-9]/g, "_")}_${cpf.replace(/\D/g, "")}.pdf`);
      return;
    }

    setErroPdf(`PDF não disponível para ${r.local}. Nenhuma captura foi realizada.`);
  }

  const [baixandoTodos, setBaixandoTodos] = useState(false);

  async function handleBaixarTodos() {
    if (resultados.length === 0) return;
    setErroPdf("");
    setBaixandoTodos(true);

    const comPdf = resultados.filter(r => r.pdfBase64);
    if (comPdf.length === 0) {
      setErroPdf("Nenhuma captura disponível para download.");
      setBaixandoTodos(false);
      return;
    }

    try {
      const mergedPdf = await PDFDocument.create();

      for (const r of comPdf) {
        const byteChars = atob(r.pdfBase64!);
        const byteNumbers = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }

        try {
          const srcDoc = await PDFDocument.load(byteNumbers);
          const pages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
          for (const pg of pages) {
            mergedPdf.addPage(pg);
          }
        } catch {
          console.warn(`Falha ao processar PDF de ${r.local}`);
        }
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes], { type: "application/pdf" });
      const cpfNumerico = cpf.replace(/\D/g, "");
      downloadBlob(blob, `pesquisa_completa_${cpfNumerico}.pdf`);
    } catch {
      setErroPdf("Erro ao juntar os PDFs.");
    } finally {
      setBaixandoTodos(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handlePesquisar();
  }


  return (
    <Layout>
      <div className="max-w-6xl mx-auto py-4">
        <div className="mb-4 text-center">
          <h2 className="font-display text-xl font-bold text-foreground">7. Pesquisa de Litispendência</h2>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex flex-col md:flex-row">
            <div className="md:w-64 border-b md:border-b-0 md:border-r border-border p-4 shrink-0">
              <h3 className="font-bold text-sm text-foreground uppercase mb-3 tracking-wider">Pesquisas</h3>

              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-0.5">CPF:</label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                    onKeyDown={handleKeyDown}
                    placeholder="000.000.000-00"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-[#5b9bd5]/30 focus:border-[#5b9bd5]/50 font-mono transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-0.5">Data Nascimento:</label>
                  <input
                    type="text"
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(formatDate(e.target.value))}
                    onKeyDown={handleKeyDown}
                    placeholder="dd/mm/aaaa"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-[#5b9bd5]/30 focus:border-[#5b9bd5]/50 font-mono transition-all"
                  />
                </div>

                {erro && (
                  <p className="text-xs text-red-400">{erro}</p>
                )}

                <button
                  onClick={handlePesquisar}
                  disabled={pesquisando || !cpf.trim()}
                  className="w-full bg-[#3a7abd] hover:bg-[#2d6aaa] disabled:bg-[#3a7abd]/50 disabled:cursor-not-allowed text-white font-bold text-sm py-2 px-3 rounded-lg transition-colors duration-200 shadow-sm"
                >
                  {pesquisando ? "Pesquisando..." : "Pesquisar CPF"}
                </button>

                {pesquisando && fonteAtual && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                    <p className="text-xs text-blue-400 animate-pulse">
                      Acessando {fonteAtual}...
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-semibold mb-2">Links consulta</p>
                <div className="space-y-0.5 max-h-64 overflow-y-auto">
                  {CONSULTAS.filter(c => "url" in c && c.url).map((c) => (
                    <a
                      key={c.key}
                      href={(c as { url: string }).url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={"descricao" in c ? (c as { descricao: string }).descricao : c.label}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-blue-400 py-0.5 transition-colors"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 shrink-0">
                        <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm7.5-3.25a.75.75 0 01.75-.75h4.5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0V4.06l-6.22 6.22a.75.75 0 11-1.06-1.06L14.94 3H12.5a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                      </svg>
                      {c.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="p-3 border-b border-border bg-muted/20">
                <h3 className="font-bold text-sm text-foreground uppercase tracking-wider">Resultados</h3>
              </div>

              <div className="grid grid-cols-[180px_1fr_90px] border-b border-border bg-muted/30">
                <div className="px-3 py-2 text-xs font-bold text-foreground uppercase tracking-wide border-r border-border">
                  Local
                </div>
                <div className="px-3 py-2 text-xs font-bold text-foreground uppercase tracking-wide border-r border-border">
                  Mensagem
                </div>
                <div className="px-3 py-2 text-xs font-bold text-foreground uppercase tracking-wide">
                  Arquivo
                </div>
              </div>

              <div className="min-h-[400px] max-h-[600px] overflow-y-auto">
                {resultados.length > 0 ? (
                  resultados.map((r, i) => {
                    const temInfo = r.mensagem !== "Nenhuma informação neste local";
                    return (
                      <div key={i} className="grid grid-cols-[180px_1fr_90px] border-b border-border last:border-b-0">
                        <div className={`px-3 py-2 text-sm border-r border-border font-semibold ${temInfo ? "text-green-400" : "text-muted-foreground"}`}>
                          {r.local}
                        </div>
                        <div className={`px-3 py-2 text-sm border-r border-border ${temInfo ? "text-foreground" : "text-muted-foreground/60 italic"}`}>
                          {r.mensagem}
                        </div>
                        <div className="px-3 py-2 text-sm">
                          {r.pdfBase64 ? (
                            <button
                              onClick={() => handleBaixarPdf(i)}
                              className="flex items-center gap-1 text-green-400 hover:text-green-300 transition-colors text-xs font-medium"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                                <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                              </svg>
                              PDF
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">--</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground/50">
                    {pesquisaFeita ? "Nenhuma pesquisa" : "Nenhuma pesquisa"}
                  </div>
                )}
              </div>

              {erroPdf && (
                <div className="px-3 py-2 bg-red-500/10 border-t border-red-500/20">
                  <p className="text-xs text-red-400">{erroPdf}</p>
                </div>
              )}

              {pesquisaFeita && resultados.length > 0 && (
                <div className="p-3 border-t border-border bg-muted/20 flex justify-end">
                  <button
                    onClick={handleBaixarTodos}
                    disabled={baixandoTodos}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white text-sm font-bold rounded transition-colors"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                      <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                    </svg>
                    {baixandoTodos ? "Juntando PDFs... aguarde" : "Baixar Todos em PDF Único"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
