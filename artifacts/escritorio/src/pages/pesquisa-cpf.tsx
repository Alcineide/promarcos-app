import { Layout } from "@/components/layout";
import { useState, useCallback } from "react";

interface PesquisaResult {
  local: string;
  mensagem: string;
  dados?: Record<string, unknown>;
  baixando?: boolean;
}

const CONSULTAS = [
  { key: "local", label: "Sistema Local" },
  { key: "promarcos", label: "Promarcos" },
  { key: "dap", label: "DAP", url: "https://smap14.mda.gov.br/extratodap/PesquisarDAP", descricao: "Declaração de Aptidão ao PRONAF" },
  { key: "caf", label: "CAF", url: "https://caf.mda.gov.br/consulta-publica/ufpa", descricao: "Cadastro da Agricultura Familiar" },
  { key: "incra", label: "INCRA", url: "https://saladacidadania.incra.gov.br", descricao: "Sala da Cidadania - INCRA" },
  { key: "sncr", label: "SNCR", url: "https://sncr.serpro.gov.br/sncr/public/pages/consulta/consultaImovelPublicoByCpfCnpj.jsf", descricao: "Sistema Nacional de Cadastro Rural" },
  { key: "sigef", label: "SIGEF", url: "https://sigef.incra.gov.br/geo/parcela/", descricao: "Sistema de Gestão Fundiária - INCRA" },
  { key: "registro_rural", label: "REGISTRO RURAL", url: "https://www.registrorural.com.br", descricao: "Registro Rural" },
  { key: "pesqbrasil", label: "PESQBRASIL", url: "https://sistemas.mpa.gov.br/pesqbrasil/publico/pesquisa", descricao: "Pesca Brasil - MPA" },
  { key: "sisrgp", label: "SisRGP", url: "https://sistemas.mpa.gov.br/sisrgp/pages/consultar/consultarLicencaPublico.jsf", descricao: "Registro Geral da Pesca - MPA" },
  { key: "cnd_to", label: "CND-TO", url: "https://app.sefaz.to.gov.br/SINTEGRA-WEB/", descricao: "SINTEGRA Tocantins - SEFAZ-TO" },
  { key: "contag", label: "CONTAG", url: "https://www.contag.org.br", descricao: "Confederação Nacional Trab. na Agricultura" },
  { key: "pje_trf1", label: "PJE-TRF1", url: "https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam", descricao: "PJe TRF1 - Processos Eletrônicos (Novo)" },
  { key: "trf1_secao_to", label: "TRF1-SEÇÃO-TO", url: "https://processual.trf1.jus.br/consultaProcessual/consultaProcessual.php?secao=TO", descricao: "TRF1 Seção Judiciária TO - Processos Físicos (Antigo)" },
  { key: "trf1_araguaina", label: "TRF1-ARAGUAÍNA", url: "https://processual.trf1.jus.br/consultaProcessual/consultaProcessual.php?secao=TO&subsecao=ARAGUAINA", descricao: "TRF1 Subseção Araguaína - Processos Físicos (Antigo)" },
  { key: "trf1_balsas", label: "TRF1-BALSAS", url: "https://processual.trf1.jus.br/consultaProcessual/consultaProcessual.php?secao=MA&subsecao=BALSAS", descricao: "TRF1 Subseção Balsas - Processos Físicos (Antigo)" },
  { key: "trf1_imperatriz", label: "TRF1-IMPERATRIZ", url: "https://processual.trf1.jus.br/consultaProcessual/consultaProcessual.php?secao=MA&subsecao=IMPERATRIZ", descricao: "TRF1 Subseção Imperatriz - Processos Físicos (Antigo)" },
  { key: "trf1_palmas", label: "TRF1-PALMAS", url: "https://processual.trf1.jus.br/consultaProcessual/consultaProcessual.php?secao=TO&subsecao=PALMAS", descricao: "TRF1 Subseção Palmas - Processos Físicos (Antigo)" },
  { key: "trf1_gurupi", label: "TRF1-GURUPI", url: "https://processual.trf1.jus.br/consultaProcessual/consultaProcessual.php?secao=TO&subsecao=GURUPI", descricao: "TRF1 Subseção Gurupi - Processos Físicos (Antigo)" },
  { key: "tse_local_votacao", label: "TSE-LOCAL VOTAÇÃO", url: "https://www.tse.jus.br/servicos-eleitorais/titulo-e-local-de-votacao/consulta-por-nome", descricao: "Consulta Local de Votação - TSE" },
  { key: "tse_certidao", label: "TSE-CERTIDÃO", url: "https://www.tse.jus.br/servicos-eleitorais/certidoes/certidao-de-quitacao-eleitoral", descricao: "Certidão de Quitação Eleitoral - TSE" },
];

export default function PesquisaCpf() {
  const [cpf, setCpf] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [nomeMae, setNomeMae] = useState("");
  const [nomePai, setNomePai] = useState("");
  const [resultados, setResultados] = useState<PesquisaResult[]>([]);
  const [pesquisando, setPesquisando] = useState(false);
  const [fonteAtual, setFonteAtual] = useState("");
  const [pesquisaFeita, setPesquisaFeita] = useState(false);
  const [erro, setErro] = useState("");
  const [lendoRg, setLendoRg] = useState(false);

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
        const res = await fetch(`/api/pesquisa-cpf/${consulta.key}/${cpfNumerico}`);
        if (res.ok) {
          const data = await res.json();
          setResultados((prev) => [...prev, {
            local: consulta.label,
            mensagem: data.encontrado ? (data.mensagem || "Informação localizada") : "Nenhuma informação neste local",
            dados: data.dados || undefined,
          }]);
        } else {
          setResultados((prev) => [...prev, {
            local: consulta.label,
            mensagem: "Nenhuma informação neste local",
          }]);
        }
      } catch {
        setResultados((prev) => [...prev, {
          local: consulta.label,
          mensagem: "Nenhuma informação neste local",
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
    if (consulta.key === "local" || consulta.key === "promarcos") return null;
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

  async function handleBaixarPdf(index: number) {
    const r = resultados[index];
    setResultados((prev) => prev.map((item, i) => i === index ? { ...item, baixando: true } : item));
    setErroPdf("");
    try {
      const siteKey = getSiteKey(r.local);
      let res: Response;

      if (siteKey) {
        res = await fetch("/api/pesquisa/capturar-pagina", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteKey, cpf: cpf.replace(/\D/g, "") }),
        });
      } else {
        res = await fetch("/api/pesquisa/gerar-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cpf, dataNascimento, nomeMae, nomePai, local: r.local, mensagem: r.mensagem, dados: r.dados }),
        });
      }

      if (res.ok) {
        const blob = await res.blob();
        downloadBlob(blob, `pesquisa_${r.local.replace(/[^a-zA-Z0-9]/g, "_")}_${cpf.replace(/\D/g, "")}.pdf`);
      } else {
        setErroPdf(`Erro ao gerar PDF de ${r.local}`);
      }
    } catch (err) {
      console.error("Erro ao baixar PDF:", err);
      setErroPdf(`Erro ao gerar PDF de ${r.local}. Tente novamente.`);
    }
    setResultados((prev) => prev.map((item, i) => i === index ? { ...item, baixando: false } : item));
  }

  const [baixandoTodos, setBaixandoTodos] = useState(false);

  async function handleBaixarTodos() {
    if (resultados.length === 0) return;
    setBaixandoTodos(true);
    setErroPdf("");
    try {
      const siteKeys = resultados
        .map(r => getSiteKey(r.local))
        .filter((k): k is string => k !== null);

      const res = await fetch("/api/pesquisa/capturar-todas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: cpf.replace(/\D/g, ""), sites: siteKeys }),
      });

      if (res.ok) {
        const blob = await res.blob();
        downloadBlob(blob, `capturas_completas_${cpf.replace(/\D/g, "")}.pdf`);
      } else {
        setErroPdf("Erro ao gerar PDFs. Tente novamente.");
      }
    } catch (err) {
      console.error("Erro ao baixar todos:", err);
      setErroPdf("Erro ao gerar PDFs. Tente novamente.");
    }
    setBaixandoTodos(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handlePesquisar();
  }

  async function handleLerRg(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLendoRg(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          const res = await fetch("/api/pesquisa/extrair-rg", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileName: file.name, fileBase64: base64, mimeType: file.type }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.nomeMae) setNomeMae(data.nomeMae.toUpperCase());
            if (data.nomePai) setNomePai(data.nomePai.toUpperCase());
          }
        } catch { /* silently fail */ }
        setLendoRg(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setLendoRg(false);
    }
    e.target.value = "";
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto py-4">
        <div className="mb-4 text-center">
          <h2 className="font-display text-xl font-bold text-foreground">7. Pesquisa</h2>
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
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 font-mono"
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
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-0.5">Nome da Mãe:</label>
                  <input
                    type="text"
                    value={nomeMae}
                    onChange={(e) => setNomeMae(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown}
                    placeholder="NOME DA MÃE"
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-0.5">Nome do Pai:</label>
                  <input
                    type="text"
                    value={nomePai}
                    onChange={(e) => setNomePai(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown}
                    placeholder="NOME DO PAI"
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 uppercase"
                  />
                </div>

                <label className={`flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded text-sm font-medium cursor-pointer transition-colors ${lendoRg ? "bg-yellow-600/50 text-yellow-300" : "bg-blue-600 hover:bg-blue-700 text-white"}`}>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M1 8a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 018.07 3h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0016.07 6H17a2 2 0 012 2v7a2 2 0 01-2 2H3a2 2 0 01-2-2V8z" />
                    <path d="M10 14a3 3 0 100-6 3 3 0 000 6z" />
                  </svg>
                  {lendoRg ? "Lendo..." : "Ler RG"}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={handleLerRg}
                    className="hidden"
                    disabled={lendoRg}
                  />
                </label>

                {erro && (
                  <p className="text-xs text-red-400">{erro}</p>
                )}

                <button
                  onClick={handlePesquisar}
                  disabled={pesquisando || !cpf.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white font-bold text-sm py-2 px-3 rounded transition-colors duration-200"
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
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
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
                          <button
                            onClick={() => handleBaixarPdf(i)}
                            disabled={r.baixando}
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-wait"
                          >
                            {r.baixando ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                <span className="animate-pulse">Capturando...</span>
                              </>
                            ) : (
                              <>
                                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                  <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                                  <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                                </svg>
                                PDF
                              </>
                            )}
                          </button>
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
                    {baixandoTodos ? "Capturando páginas... aguarde" : "Baixar Todos em PDF"}
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
