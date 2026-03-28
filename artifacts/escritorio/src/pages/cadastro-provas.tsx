import { Layout } from "@/components/layout";
import { useState, useCallback } from "react";

interface Prova {
  id: number;
  cpf: string;
  tipoProva: string;
  descricaoProva: string;
  dataProva: string | null;
  idProva: string | null;
}

export default function CadastroProvas() {
  const [cpf, setCpf] = useState("");
  const [tipoProva, setTipoProva] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataProva, setDataProva] = useState("");
  const [idProva, setIdProva] = useState("");
  const [provas, setProvas] = useState<Prova[]>([]);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [mensagemTipo, setMensagemTipo] = useState<"sucesso" | "erro" | "">("");
  const [lendoDoc, setLendoDoc] = useState(false);

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

  function mostrarMensagem(texto: string, tipo: "sucesso" | "erro") {
    setMensagem(texto);
    setMensagemTipo(tipo);
    setTimeout(() => { setMensagem(""); setMensagemTipo(""); }, 4000);
  }

  const buscarProvas = useCallback(async (cpfBusca?: string) => {
    const cpfUsar = cpfBusca || cpf;
    const cpfNumerico = cpfUsar.replace(/\D/g, "");
    if (cpfNumerico.length !== 11) return;
    setCarregando(true);
    try {
      const res = await fetch(`/api/provas/${cpfNumerico}`);
      if (res.ok) {
        const data = await res.json();
        setProvas(data);
      }
    } catch {
      mostrarMensagem("Erro ao buscar provas", "erro");
    } finally {
      setCarregando(false);
    }
  }, [cpf]);

  async function handleGravar() {
    const cpfNumerico = cpf.replace(/\D/g, "");
    if (cpfNumerico.length !== 11) {
      mostrarMensagem("CPF deve ter 11 dígitos", "erro");
      return;
    }
    try {
      if (editandoId) {
        const res = await fetch(`/api/provas/${editandoId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipoProva, descricaoProva: descricao, dataProva, idProva }),
        });
        if (res.ok) {
          mostrarMensagem("Prova atualizada com sucesso", "sucesso");
          setEditandoId(null);
        } else {
          mostrarMensagem("Erro ao atualizar prova", "erro");
        }
      } else {
        const res = await fetch("/api/provas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cpf: formatCpf(cpf), tipoProva, descricaoProva: descricao, dataProva, idProva }),
        });
        if (res.ok) {
          mostrarMensagem("Prova gravada com sucesso", "sucesso");
        } else {
          mostrarMensagem("Erro ao gravar prova", "erro");
        }
      }
      await buscarProvas();
      handleNovo();
    } catch {
      mostrarMensagem("Erro ao gravar prova", "erro");
    }
  }

  async function handleExcluir() {
    if (!editandoId) {
      mostrarMensagem("Selecione uma prova para excluir", "erro");
      return;
    }
    if (!confirm("Deseja realmente excluir esta prova?")) return;
    try {
      const res = await fetch(`/api/provas/${editandoId}`, { method: "DELETE" });
      if (res.ok) {
        mostrarMensagem("Prova excluída com sucesso", "sucesso");
        handleNovo();
        await buscarProvas();
      } else {
        mostrarMensagem("Erro ao excluir prova", "erro");
      }
    } catch {
      mostrarMensagem("Erro ao excluir prova", "erro");
    }
  }

  function handleNovo() {
    setTipoProva("");
    setDescricao("");
    setDataProva("");
    setIdProva("");
    setEditandoId(null);
  }

  function handleSelecionarProva(prova: Prova) {
    setTipoProva(prova.tipoProva);
    setDescricao(prova.descricaoProva);
    setDataProva(prova.dataProva || "");
    setIdProva(prova.idProva || "");
    setEditandoId(prova.id);
  }

  async function handleLerDocumento(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLendoDoc(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          const res = await fetch("/api/provas/extrair-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileName: file.name, fileBase64: base64, mimeType: file.type }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.tipoProva) setTipoProva(data.tipoProva);
            if (data.descricao) setDescricao(data.descricao);
            if (data.dataProva) setDataProva(data.dataProva);
            if (data.idProva) setIdProva(data.idProva);
            mostrarMensagem("Documento lido com sucesso", "sucesso");
          } else {
            mostrarMensagem("Não foi possível extrair dados do documento", "erro");
          }
        } catch {
          mostrarMensagem("Erro ao processar documento", "erro");
        } finally {
          setLendoDoc(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      mostrarMensagem("Erro ao ler arquivo", "erro");
      setLendoDoc(false);
    }
    e.target.value = "";
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto py-4">
        <div className="mb-4 text-center">
          <h2 className="font-display text-xl font-bold text-foreground">5. Cadastro de Provas</h2>
        </div>

        {mensagem && (
          <div className={`mb-3 px-4 py-2 rounded text-sm font-medium ${mensagemTipo === "sucesso" ? "bg-green-600/20 text-green-400 border border-green-500/30" : "bg-red-600/20 text-red-400 border border-red-500/30"}`}>
            {mensagem}
          </div>
        )}

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-4">
                <label className="block text-xs text-muted-foreground mb-0.5">CPF:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                    onBlur={() => buscarProvas()}
                    onKeyDown={(e) => e.key === "Enter" && buscarProvas()}
                    placeholder="000.000.000-00"
                    className="w-48 bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 font-mono"
                  />
                  <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium cursor-pointer transition-colors ${lendoDoc ? "bg-yellow-600/50 text-yellow-300" : "bg-blue-600 hover:bg-blue-700 text-white"}`}>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    {lendoDoc ? "Lendo..." : "Ler documento"}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp"
                      onChange={handleLerDocumento}
                      className="hidden"
                      disabled={lendoDoc}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-0.5">Tipo da Prova:</label>
                <input
                  type="text"
                  value={tipoProva}
                  onChange={(e) => setTipoProva(e.target.value)}
                  placeholder="Ex: CTPS, CNIS, PPP..."
                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-0.5">Descrição:</label>
                <input
                  type="text"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descrição da prova"
                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-0.5">Data da Prova:</label>
                <input
                  type="text"
                  value={dataProva}
                  onChange={(e) => setDataProva(formatDate(e.target.value))}
                  placeholder="dd/mm/aaaa"
                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-0.5">ID Prova:</label>
                <input
                  type="text"
                  value={idProva}
                  onChange={(e) => setIdProva(e.target.value)}
                  placeholder="ID"
                  readOnly={false}
                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={handleGravar}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded transition-colors"
              >
                {editandoId ? "Salvar registro" : "Gravar"}
              </button>
              <button
                onClick={handleExcluir}
                disabled={!editandoId}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-600/30 disabled:cursor-not-allowed text-white text-sm font-bold rounded transition-colors"
              >
                Excluir
              </button>
              <button
                onClick={handleNovo}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded transition-colors"
              >
                Novo registro
              </button>
            </div>
          </div>

          <div>
            <div className="grid grid-cols-[48px_112px_144px_1fr_80px_64px] border-b border-border bg-muted/30">
              <div className="px-2 py-2 text-xs font-bold text-foreground uppercase tracking-wide border-r border-border">ID</div>
              <div className="px-2 py-2 text-xs font-bold text-foreground uppercase tracking-wide border-r border-border">CPF</div>
              <div className="px-2 py-2 text-xs font-bold text-foreground uppercase tracking-wide border-r border-border">Tipo da Prova</div>
              <div className="px-2 py-2 text-xs font-bold text-foreground uppercase tracking-wide border-r border-border">Descrição</div>
              <div className="px-2 py-2 text-xs font-bold text-foreground uppercase tracking-wide border-r border-border">Data</div>
              <div className="px-2 py-2 text-xs font-bold text-foreground uppercase tracking-wide">Id Prova</div>
            </div>

            <div className="min-h-[200px] max-h-[400px] overflow-y-auto">
              {carregando ? (
                <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                  Carregando...
                </div>
              ) : provas.length > 0 ? (
                provas.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSelecionarProva(p)}
                    className={`grid grid-cols-[48px_112px_144px_1fr_80px_64px] border-b border-border last:border-b-0 cursor-pointer transition-colors ${editandoId === p.id ? "bg-blue-600/20" : "hover:bg-muted/30"}`}
                  >
                    <div className="px-2 py-2 text-sm text-muted-foreground border-r border-border truncate">{p.id}</div>
                    <div className="px-2 py-2 text-sm text-foreground border-r border-border truncate font-mono">{p.cpf}</div>
                    <div className="px-2 py-2 text-sm text-foreground border-r border-border truncate">{p.tipoProva}</div>
                    <div className="px-2 py-2 text-sm text-foreground border-r border-border truncate">{p.descricaoProva}</div>
                    <div className="px-2 py-2 text-sm text-foreground border-r border-border truncate">{p.dataProva || ""}</div>
                    <div className="px-2 py-2 text-sm text-muted-foreground truncate">{p.idProva || ""}</div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground/50">
                  Nenhuma prova encontrada
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
