import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import {
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  MapPin,
  Smartphone,
  Clock,
  User,
  FileText,
  UserPlus,
  Eye,
  Upload,
  Loader2,
  X,
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

const TIPO_ACAO_LABELS: Record<string, { label: string; icon: typeof Activity; color: string }> = {
  consulta: { label: "Consulta", icon: Eye, color: "text-blue-500 bg-blue-50" },
  alteracao: { label: "Alteração", icon: FileText, color: "text-amber-500 bg-amber-50" },
  cadastro_novo: { label: "Novo Cadastro", icon: UserPlus, color: "text-green-500 bg-green-50" },
  upload_documento: { label: "Upload Documento", icon: Upload, color: "text-purple-500 bg-purple-50" },
  pesquisa_cpf: { label: "Pesquisa CPF", icon: Search, color: "text-teal-500 bg-teal-50" },
};

const PAGE_SIZE = 30;

export default function AdminAuditoria() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const [filtroColaborador, setFiltroColaborador] = useState("");
  const [filtroCpf, setFiltroCpf] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroDe, setFiltroDe] = useState("");
  const [filtroAte, setFiltroAte] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      if (filtroColaborador) params.set("colaborador", filtroColaborador);
      if (filtroCpf) params.set("cpf", filtroCpf);
      if (filtroTipo) params.set("tipo", filtroTipo);
      if (filtroDe) params.set("de", filtroDe);
      if (filtroAte) params.set("ate", filtroAte);

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
  }, [user?.email, page, filtroColaborador, filtroCpf, filtroTipo, filtroDe, filtroAte]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilter = () => {
    setPage(0);
    fetchLogs();
  };

  const clearFilters = () => {
    setFiltroColaborador("");
    setFiltroCpf("");
    setFiltroTipo("");
    setFiltroDe("");
    setFiltroAte("");
    setPage(0);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = filtroColaborador || filtroCpf || filtroTipo || filtroDe || filtroAte;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatCpf = (cpf: string) => {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    return cpf;
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-primary mb-2 flex items-center gap-3">
              <Activity className="w-8 h-8" />
              Auditoria de Atividades
            </h1>
            <p className="text-muted-foreground text-lg">
              Acompanhe as ações dos colaboradores no sistema.
            </p>
            {total > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {total} registro{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all",
              showFilters
                ? "bg-primary text-white"
                : "bg-card border border-border text-foreground hover:bg-muted"
            )}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {hasFilters && (
              <span className="w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>
        </header>

        {showFilters && (
          <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Colaborador (e-mail)</label>
                <input
                  type="text"
                  value={filtroColaborador}
                  onChange={(e) => setFiltroColaborador(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">CPF Consultado</label>
                <input
                  type="text"
                  value={filtroCpf}
                  onChange={(e) => setFiltroCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de Ação</label>
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background text-foreground text-sm"
                >
                  <option value="">Todos</option>
                  <option value="consulta">Consulta</option>
                  <option value="alteracao">Alteração</option>
                  <option value="cadastro_novo">Novo Cadastro</option>
                  <option value="upload_documento">Upload Documento</option>
                  <option value="pesquisa_cpf">Pesquisa CPF</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Data início</label>
                <input
                  type="date"
                  value={filtroDe}
                  onChange={(e) => setFiltroDe(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Data fim</label>
                <input
                  type="date"
                  value={filtroAte}
                  onChange={(e) => setFiltroAte(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background text-foreground text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleFilter}
                className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors text-sm"
              >
                Buscar
              </button>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="px-6 py-2.5 border border-border text-muted-foreground font-medium rounded-xl hover:bg-muted transition-colors text-sm flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Limpar
                </button>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Activity className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Nenhuma atividade encontrada</p>
            <p className="text-sm mt-1">
              {hasFilters
                ? "Tente alterar os filtros de busca."
                : "As atividades dos colaboradores aparecerão aqui."}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {logs.map((log) => {
                const meta = TIPO_ACAO_LABELS[log.tipoAcao] || {
                  label: log.tipoAcao,
                  icon: Activity,
                  color: "text-gray-500 bg-gray-50",
                };
                const Icon = meta.icon;
                const isExpanded = expandedLog === log.id;

                return (
                  <div
                    key={log.id}
                    className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                  >
                    <div className="p-4 flex items-center gap-4">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", meta.color)}>
                        <Icon className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-sm">{meta.label}</span>
                          {log.cpfConsultado && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-mono">
                              CPF: {formatCpf(log.cpfConsultado)}
                            </span>
                          )}
                          {log.termoBuscado && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                              "{log.termoBuscado}"
                            </span>
                          )}
                          {log.haviacadastro && (
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                              log.haviacadastro === "sim"
                                ? "bg-green-100 text-green-700"
                                : "bg-orange-100 text-orange-700"
                            )}>
                              {log.haviacadastro === "sim" ? "Já cadastrado" : "Novo"}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {log.colaboradorEmail}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(log.dataHora)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 border-t border-border/30 mt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 text-sm">
                          {log.colaboradorCodigo && (
                            <div>
                              <span className="text-muted-foreground text-xs">Código colaborador:</span>
                              <p className="font-mono">{log.colaboradorCodigo}</p>
                            </div>
                          )}
                          {log.deviceId && (
                            <div className="flex items-start gap-1.5">
                              <Smartphone className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                              <div>
                                <span className="text-muted-foreground text-xs">Device ID:</span>
                                <p className="font-mono text-xs break-all">{log.deviceId}</p>
                              </div>
                            </div>
                          )}
                          {(log.latitude && log.longitude) && (
                            <div className="flex items-start gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                              <div>
                                <span className="text-muted-foreground text-xs">Localização:</span>
                                <p className="font-mono text-xs">{log.latitude}, {log.longitude}</p>
                                <a
                                  href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-blue-500 hover:underline"
                                >
                                  Ver no mapa
                                </a>
                              </div>
                            </div>
                          )}
                          {log.camposAlterados && (
                            <div className="md:col-span-2">
                              <span className="text-muted-foreground text-xs">Campos alterados:</span>
                              <pre className="bg-muted rounded-lg p-2 text-xs mt-1 overflow-x-auto">
                                {JSON.stringify(log.camposAlterados, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.syncedAt && (
                            <div>
                              <span className="text-muted-foreground text-xs">Sincronizado em:</span>
                              <p className="text-xs">{formatDate(log.syncedAt)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-4">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-muted-foreground">
                  Página {page + 1} de {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
