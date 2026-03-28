import { Layout } from "@/components/layout";
import { useState } from "react";

interface PesquisaResult {
  local: string;
  mensagem: string;
}

export default function PesquisaCpf() {
  const [cpf, setCpf] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [resultados, setResultados] = useState<PesquisaResult[]>([]);
  const [pesquisando, setPesquisando] = useState(false);
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

  async function handlePesquisar() {
    const cpfNumerico = cpf.replace(/\D/g, "");
    if (cpfNumerico.length !== 11) {
      setErro("CPF deve ter 11 dígitos");
      return;
    }
    setPesquisando(true);
    setPesquisaFeita(false);
    setErro("");
    setResultados([]);

    try {
      const res = await fetch(`/api/pesquisa-cpf/${cpfNumerico}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao pesquisar");
      }
      const data: PesquisaResult[] = await res.json();
      setResultados(data);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao pesquisar CPF");
    } finally {
      setPesquisaFeita(true);
      setPesquisando(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handlePesquisar();
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-4">
        <div className="mb-6 text-center">
          <span className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/25 text-green-300 text-xs font-medium tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.867-3.834zm-5.44.306a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/>
            </svg>
            Consulta
          </span>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-2">
            Pesquisa <span className="text-green-400">CPF</span>
          </h1>
          <p className="text-muted-foreground text-sm">Consulte informações por CPF e data de nascimento</p>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex flex-col md:flex-row">
            <div className="md:w-56 border-b md:border-b-0 md:border-r border-border p-5">
              <h3 className="font-display font-bold text-sm text-foreground tracking-wide uppercase mb-4">Pesquisas</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">CPF:</label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                    onKeyDown={handleKeyDown}
                    placeholder="000.000.000-00"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Data Nascimento:</label>
                  <input
                    type="text"
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(formatDate(e.target.value))}
                    onKeyDown={handleKeyDown}
                    placeholder="dd/mm/aaaa"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50"
                  />
                </div>

                {erro && (
                  <p className="text-xs text-red-400">{erro}</p>
                )}

                <button
                  onClick={handlePesquisar}
                  disabled={pesquisando || !cpf.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white font-bold text-sm py-2.5 px-4 rounded-lg transition-colors duration-200 mt-1"
                >
                  {pesquisando ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/>
                        <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75"/>
                      </svg>
                      Pesquisando...
                    </span>
                  ) : (
                    "Pesquisar CPF"
                  )}
                </button>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-[1fr_2fr] border-b border-border">
                <div className="px-4 py-2.5 text-xs font-bold text-foreground uppercase tracking-wide bg-blue-600/20 border-r border-border">
                  Local
                </div>
                <div className="px-4 py-2.5 text-xs font-bold text-foreground uppercase tracking-wide bg-blue-600/20">
                  Mensagem
                </div>
              </div>

              <div className="min-h-[200px] max-h-[500px] overflow-y-auto">
                {resultados.length > 0 ? (
                  resultados.map((r, i) => (
                    <div key={i} className="grid grid-cols-[1fr_2fr] border-b border-border last:border-b-0">
                      <div className="px-4 py-3 text-sm text-foreground border-r border-border font-medium">{r.local}</div>
                      <div className="px-4 py-3 text-sm text-muted-foreground">{r.mensagem}</div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground/50">
                    {pesquisaFeita ? "Nenhuma pesquisa encontrada" : "Nenhuma pesquisa"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
