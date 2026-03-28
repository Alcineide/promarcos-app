import { Layout } from "@/components/layout";
import { useState, useCallback } from "react";

interface PesquisaResult {
  local: string;
  encontrado: boolean;
  mensagem: string;
}

const FONTES = [
  { key: "dap", label: "DAP" },
  { key: "caf", label: "CAF" },
  { key: "incra", label: "INCRA" },
  { key: "cnis", label: "CNIS" },
  { key: "ctps", label: "CTPS" },
  { key: "tribunal", label: "TRIBUNAL" },
  { key: "provas", label: "PROVAS" },
  { key: "receita", label: "RECEITA" },
  { key: "detran", label: "DETRAN" },
  { key: "jusbrasil", label: "JUSBRASIL" },
  { key: "inss", label: "INSS" },
];

export default function PesquisaCpf() {
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
    const cpfNumerico = cpf.replace(/\D/g, "");
    if (cpfNumerico.length !== 11) {
      setErro("CPF deve ter 11 dígitos");
      return;
    }
    setPesquisando(true);
    setPesquisaFeita(false);
    setErro("");
    setResultados([]);

    const allSources = [
      { key: "local", label: "Sistema Local" },
      { key: "promarcos", label: "Promarcos" },
      ...FONTES,
    ];

    for (const source of allSources) {
      setFonteAtual(source.label);
      try {
        const res = await fetch(`/api/pesquisa-cpf/${source.key}/${cpfNumerico}`);
        if (res.ok) {
          const data = await res.json();
          setResultados((prev) => [...prev, {
            local: data.local || source.label,
            encontrado: data.encontrado ?? false,
            mensagem: data.mensagem || "Consulta realizada",
          }]);
        } else {
          setResultados((prev) => [...prev, {
            local: source.label,
            encontrado: false,
            mensagem: "Erro ao consultar",
          }]);
        }
      } catch {
        setResultados((prev) => [...prev, {
          local: source.label,
          encontrado: false,
          mensagem: "Serviço indisponível",
        }]);
      }
    }

    setFonteAtual("");
    setPesquisaFeita(true);
    setPesquisando(false);
  }, [cpf]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handlePesquisar();
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-4">
        <div className="mb-4 text-center">
          <h2 className="font-display text-xl font-bold text-foreground">7. Pesquisa</h2>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex flex-col md:flex-row">
            <div className="md:w-52 border-b md:border-b-0 md:border-r border-border p-4">
              <h3 className="font-bold text-sm text-foreground uppercase mb-3">Pesquisas</h3>

              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-0.5">CPF:</label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                    onKeyDown={handleKeyDown}
                    placeholder="000.000.000-00"
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 font-mono"
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
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 font-mono"
                  />
                </div>

                {erro && (
                  <p className="text-xs text-red-400">{erro}</p>
                )}

                <button
                  onClick={handlePesquisar}
                  disabled={pesquisando || !cpf.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white font-bold text-sm py-2 px-3 rounded transition-colors duration-200"
                >
                  {pesquisando ? "Pesquisando..." : "Pesquisar"}
                </button>

                {pesquisando && fonteAtual && (
                  <p className="text-xs text-blue-400 animate-pulse">
                    Acessando {fonteAtual}...
                  </p>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-[120px_1fr] border-b border-border bg-muted/30">
                <div className="px-3 py-2 text-xs font-bold text-foreground uppercase tracking-wide border-r border-border">
                  Local
                </div>
                <div className="px-3 py-2 text-xs font-bold text-foreground uppercase tracking-wide">
                  Mensagem
                </div>
              </div>

              <div className="min-h-[300px] max-h-[500px] overflow-y-auto">
                {resultados.length > 0 ? (
                  resultados.map((r, i) => (
                    <div key={i} className="grid grid-cols-[120px_1fr] border-b border-border last:border-b-0">
                      <div className={`px-3 py-2 text-sm border-r border-border font-medium ${r.encontrado ? "text-green-400" : "text-muted-foreground"}`}>
                        {r.local}
                      </div>
                      <div className={`px-3 py-2 text-sm ${r.encontrado ? "text-foreground" : "text-muted-foreground"}`}>
                        {r.mensagem}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground/50">
                    {pesquisaFeita ? "Nenhuma pesquisa encontrada" : "Nenhuma pesquisa"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden mt-4">
          <div className="p-4">
            <h3 className="font-bold text-sm text-foreground uppercase mb-3">Consulta Pública - Tribunais</h3>
            <p className="text-xs text-muted-foreground mb-3">Sites com proteção captcha requerem consulta manual. Clique para abrir em nova aba.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { nome: "TRF1 - Justiça Federal 1ª Região", url: "https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam" },
                { nome: "TRF2 - Justiça Federal 2ª Região", url: "https://pje2g.trf2.jus.br/pje2g-consultapublica/ConsultaPublica/listView.seam" },
                { nome: "TRF3 - Justiça Federal 3ª Região", url: "https://pje1g.trf3.jus.br/pje/ConsultaPublica/listView.seam" },
                { nome: "TRF4 - Justiça Federal 4ª Região", url: "https://pje2g.trf4.jus.br/pje/ConsultaPublica/listView.seam" },
                { nome: "TRF5 - Justiça Federal 5ª Região", url: "https://pje.trf5.jus.br/pje/ConsultaPublica/listView.seam" },
                { nome: "TRF6 - Justiça Federal 6ª Região", url: "https://pje1g.trf6.jus.br/consultapublica/ConsultaPublica/listView.seam" },
                { nome: "TST - Tribunal Superior do Trabalho", url: "https://consultaprocessual.tst.jus.br/" },
                { nome: "STJ - Superior Tribunal de Justiça", url: "https://processo.stj.jus.br/processo/pesquisa/" },
              ].map((t, i) => (
                <a
                  key={i}
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded border border-border hover:bg-muted/50 transition-colors text-sm text-foreground hover:text-blue-400"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-muted-foreground shrink-0">
                    <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm7.5-3.25a.75.75 0 01.75-.75h4.5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0V4.06l-6.22 6.22a.75.75 0 11-1.06-1.06L14.94 3H12.5a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                  </svg>
                  {t.nome}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
