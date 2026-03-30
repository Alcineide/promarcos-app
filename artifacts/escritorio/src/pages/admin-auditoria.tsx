import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditLog {
  id: number;
  colaboradorEmail: string;
  colaboradorCodigo: number | null;
  cpfConsultado: string | null;
  tipoAcao: string;
  haviacadastro: string | null;
  camposAlterados: unknown;
  termoBuscado: string | null;
  latitude: string | null;
  longitude: string | null;
  dataHora: string;
  deviceId: string | null;
  syncedAt: string | null;
}

const TIPO_LABELS: Record<string, string> = {
  consulta: "Consulta",
  alteracao: "Alteração",
  cadastro_novo: "Novo Cadastro",
  upload_documento: "Upload",
  pesquisa_cpf: "Pesquisa CPF",
  litispendencia: "Litispendência",
  abertura_processo: "Novo Processo",
  agendamento_veiculo: "Agendamento",
  checkin_veiculo: "Check-in",
  checkout_veiculo: "Check-out",
  prestacao_contas: "Prestação de Contas",
};

const TIPO_COLORS: Record<string, string> = {
  consulta: "bg-blue-100 text-blue-700",
  alteracao: "bg-amber-100 text-amber-700",
  cadastro_novo: "bg-green-100 text-green-700",
  upload_documento: "bg-purple-100 text-purple-700",
  pesquisa_cpf: "bg-teal-100 text-teal-700",
  litispendencia: "bg-indigo-100 text-indigo-700",
  abertura_processo: "bg-cyan-100 text-cyan-700",
  agendamento_veiculo: "bg-sky-100 text-sky-700",
  checkin_veiculo: "bg-emerald-100 text-emerald-700",
  checkout_veiculo: "bg-orange-100 text-orange-700",
  prestacao_contas: "bg-fuchsia-100 text-fuchsia-700",
};

const FIELD_LABELS: Record<string, string> = {
  nome: "Nome", nomeCompleto: "Nome Completo", cpf: "CPF", rg: "RG",
  rgRepresentante: "RG Representante", email: "E-mail", telefone: "Telefone",
  telefone2: "Telefone 2", celular: "Celular", cep: "CEP",
  logradouro: "Logradouro", numero: "Número", bairro: "Bairro",
  cidade: "Cidade", estado: "Estado", complemento: "Complemento",
  dataNascimento: "Data de Nascimento", nomeMae: "Nome da Mãe",
  nomePai: "Nome do Pai", sexo: "Sexo", estadoCivil: "Estado Civil",
  profissao: "Profissão", nacionalidade: "Nacionalidade",
  observacao: "Observação", pis: "PIS/NIT", ctps: "CTPS",
};

function gerarDetalhes(log: AuditLog): string {
  switch (log.tipoAcao) {
    case "cadastro_novo":
      return "Abertura de cadastro";
    case "consulta":
      return "Visualização de cadastro";
    case "alteracao": {
      if (log.camposAlterados && typeof log.camposAlterados === "object") {
        const campos = Object.keys(log.camposAlterados as Record<string, unknown>);
        if (campos.length > 0) {
          const nomes = campos.map(c => FIELD_LABELS[c] || c);
          return `Atualização: ${nomes.join(", ")}`;
        }
      }
      return "Atualização de cadastro";
    }
    case "pesquisa_cpf":
      if (log.termoBuscado) return `Busca: "${log.termoBuscado}"`;
      return "Pesquisa de CPF";
    case "litispendencia":
      return "Consulta de litispendência";
    case "upload_documento":
      if (log.termoBuscado) return `Upload: ${log.termoBuscado}`;
      return "Upload de documento";
    case "abertura_processo":
      if (log.termoBuscado) return log.termoBuscado;
      return "Abertura de processo";
    case "agendamento_veiculo":
      return "Agendamento de veículo";
    case "checkin_veiculo":
      return "Check-in — Retirada de veículo";
    case "checkout_veiculo":
      return "Check-out — Devolução de veículo";
    case "prestacao_contas":
      return "Prestação de contas de veículo";
    default:
      if (log.termoBuscado) return log.termoBuscado;
      return "—";
  }
}

const PAGE_SIZE = 50;

export default function AdminAuditoria() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [page, setPage] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));

      const res = await fetch(`/api/audit/admin-logs?${params.toString()}`, {
        headers: { "x-user-email": user?.email || "" },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [user?.email, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCpf = (cpf: string) => {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    return cpf;
  };

  const formatCamposAlterados = (campos: unknown): string => {
    if (!campos) return "";
    if (typeof campos === "string") return campos;
    if (typeof campos === "object") {
      try {
        const obj = campos as Record<string, unknown>;
        const parts: string[] = [];
        for (const [key, val] of Object.entries(obj)) {
          const label = FIELD_LABELS[key] || key;
          if (typeof val === "object" && val !== null) {
            const v = val as Record<string, unknown>;
            if ("de" in v && "para" in v) {
              parts.push(`${label}: ${v.de} → ${v.para}`);
            } else if ("old" in v && "new" in v) {
              parts.push(`${label}: ${v.old} → ${v.new}`);
            } else {
              parts.push(`${label}: ${JSON.stringify(val)}`);
            }
          } else {
            parts.push(`${label}: ${val}`);
          }
        }
        return parts.join("; ");
      } catch {
        return JSON.stringify(campos);
      }
    }
    return String(campos);
  };

  const handleDownloadCSV = async () => {
    setDownloading(true);
    try {
      let allLogs: AuditLog[] = [];
      let offset = 0;
      const batchSize = 200;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams();
        params.set("limit", String(batchSize));
        params.set("offset", String(offset));
        const res = await fetch(`/api/audit/admin-logs?${params.toString()}`, {
          headers: { "x-user-email": user?.email || "" },
        });
        if (!res.ok) break;
        const data = await res.json();
        allLogs = allLogs.concat(data.logs);
        offset += batchSize;
        hasMore = allLogs.length < data.total;
      }

      const header = "Data/Hora;Colaborador;Ação;CPF;Detalhes;Alterações";
      const rows = allLogs.map((l) => {
        const dt = formatDate(l.dataHora);
        const tipo = TIPO_LABELS[l.tipoAcao] || l.tipoAcao;
        const cpf = l.cpfConsultado ? formatCpf(l.cpfConsultado) : "";
        const detalhe = gerarDetalhes(l);
        const alteracoes = formatCamposAlterados(l.camposAlterados);
        return [dt, l.colaboradorEmail, tipo, cpf, detalhe, alteracoes]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";");
      });

      const bom = "\uFEFF";
      const csv = bom + header + "\n" + rows.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-full mx-auto space-y-5">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-primary mb-1 flex items-center gap-3">
              <Activity className="w-7 h-7" />
              Auditoria de Atividades
            </h1>
            <p className="text-muted-foreground">
              {total} registro{total !== 1 ? "s" : ""} de atividade{total !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setPage(0); fetchLogs(); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-card border border-border text-foreground hover:bg-muted transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </button>
            <button
              onClick={handleDownloadCSV}
              disabled={downloading || total === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#1c3654] to-[#2a5080] text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Baixar CSV
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Activity className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Nenhuma atividade registrada ainda</p>
            <p className="text-sm mt-1">
              As atividades dos colaboradores aparecerão aqui automaticamente.
            </p>
          </div>
        ) : (
          <>
            <div ref={tableRef} className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border/50">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Data/Hora</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Colaborador</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Ação</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">CPF</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Detalhes</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Alterações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, idx) => {
                      const alteracoes = formatCamposAlterados(log.camposAlterados);
                      return (
                        <tr
                          key={log.id}
                          className={cn(
                            "border-b border-border/30 hover:bg-muted/30 transition-colors",
                            idx % 2 === 0 ? "bg-background" : "bg-muted/10"
                          )}
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground font-mono">
                            {formatDate(log.dataHora)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-foreground">
                            {log.colaboradorEmail}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={cn(
                              "text-[11px] font-bold px-2.5 py-1 rounded-full",
                              TIPO_COLORS[log.tipoAcao] || "bg-gray-100 text-gray-700"
                            )}>
                              {TIPO_LABELS[log.tipoAcao] || log.tipoAcao}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-foreground">
                            {log.cpfConsultado ? formatCpf(log.cpfConsultado) : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[300px] truncate" title={gerarDetalhes(log)}>
                            {gerarDetalhes(log)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[300px]">
                            {alteracoes ? (
                              <span className="text-xs break-words whitespace-pre-wrap">{alteracoes}</span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm text-muted-foreground px-2">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
