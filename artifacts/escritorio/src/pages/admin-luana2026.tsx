import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { Monitor, Smartphone, Loader2, CheckCircle, Ban, Trash2, RefreshCw, Users, Shield, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface LuanaDevice {
  id: number;
  fingerprint: string;
  device_label: string;
  status: string;
  ip_address: string;
  user_agent: string;
  criado_em: string;
  autorizado_em: string | null;
}

interface LuanaUser {
  id: number;
  email: string;
  name: string;
  role: string;
  active: boolean;
  criado_em: string;
}

type Tab = "dispositivos" | "usuarios";

export default function AdminLuana2026() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("dispositivos");
  const [dispositivos, setDispositivos] = useState<LuanaDevice[]>([]);
  const [usuarios, setUsuarios] = useState<LuanaUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [novoEmail, setNovoEmail] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoSenha, setNovoSenha] = useState("");
  const [novoRole, setNovoRole] = useState("colaborador");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchDispositivos = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/luana2026/dispositivos", {
        headers: { "x-user-email": user?.email || "" },
      });
      if (res.ok) {
        setDispositivos(await res.json());
      } else {
        const data = await res.json();
        setError(data.error || "Erro ao conectar com Luana 2026");
      }
    } catch {
      setError("Falha ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/luana2026/usuarios", {
        headers: { "x-user-email": user?.email || "" },
      });
      if (res.ok) {
        setUsuarios(await res.json());
      } else {
        const data = await res.json();
        setError(data.error || "Erro ao conectar com Luana 2026");
      }
    } catch {
      setError("Falha ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    if (tab === "dispositivos") fetchDispositivos();
    else fetchUsuarios();
  }, [tab, fetchDispositivos, fetchUsuarios]);

  const handleUpdateDevice = async (id: number, status: string, label?: string) => {
    try {
      const res = await fetch(`/api/luana2026/dispositivos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-email": user?.email || "" },
        body: JSON.stringify({ status, device_label: label || "" }),
      });
      if (res.ok) {
        toast({ title: "Sucesso", description: status === "autorizado" ? "Dispositivo autorizado!" : "Dispositivo bloqueado!" });
        fetchDispositivos();
      } else {
        toast({ title: "Erro", description: "Falha ao atualizar dispositivo", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao conectar", variant: "destructive" });
    }
  };

  const handleDeleteDevice = async (id: number) => {
    if (!confirm("Remover este dispositivo?")) return;
    try {
      const res = await fetch(`/api/luana2026/dispositivos/${id}`, {
        method: "DELETE",
        headers: { "x-user-email": user?.email || "" },
      });
      if (res.ok) {
        toast({ title: "Sucesso", description: "Dispositivo removido!" });
        fetchDispositivos();
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao remover", variant: "destructive" });
    }
  };

  const handleAddUser = async () => {
    if (!novoEmail.trim() || !novoNome.trim() || !novoSenha.trim()) {
      toast({ title: "Atenção", description: "Preencha todos os campos.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/luana2026/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": user?.email || "" },
        body: JSON.stringify({ email: novoEmail.trim(), name: novoNome.trim(), senha: novoSenha.trim(), role: novoRole }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Sucesso", description: "Usuário adicionado ao Luana 2026!" });
        setNovoEmail(""); setNovoNome(""); setNovoSenha(""); setNovoRole("colaborador");
        setShowForm(false);
        fetchUsuarios();
      } else {
        toast({ title: "Erro", description: data.error || "Falha ao adicionar", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao conectar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateUser = async (id: number, data: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/luana2026/usuarios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-email": user?.email || "" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast({ title: "Sucesso", description: "Usuário atualizado!" });
        fetchUsuarios();
      } else {
        toast({ title: "Erro", description: "Falha ao atualizar", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao conectar", variant: "destructive" });
    }
  };

  const handleDeleteUser = async (id: number, name: string) => {
    if (!confirm(`Remover ${name} do Luana 2026?`)) return;
    try {
      const res = await fetch(`/api/luana2026/usuarios/${id}`, {
        method: "DELETE",
        headers: { "x-user-email": user?.email || "" },
      });
      if (res.ok) {
        toast({ title: "Sucesso", description: "Usuário removido!" });
        fetchUsuarios();
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao remover", variant: "destructive" });
    }
  };

  const pendentes = dispositivos.filter(d => d.status === "pendente");
  const autorizados = dispositivos.filter(d => d.status === "autorizado");
  const bloqueados = dispositivos.filter(d => d.status === "bloqueado");

  const getDeviceIcon = (ua: string) => {
    if (/iPhone|iPad|Android|Mobile/i.test(ua)) return <Smartphone className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-primary mb-2 flex items-center gap-3">
              <Monitor className="w-8 h-8" />
              Luana 2026
            </h1>
            <p className="text-muted-foreground text-lg">
              Gerencie dispositivos e usuários do sistema Luana 2026.
            </p>
          </div>
          <button
            onClick={() => tab === "dispositivos" ? fetchDispositivos() : fetchUsuarios()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-muted hover:bg-muted/80 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </header>

        <div className="flex gap-1 bg-muted rounded-xl p-1">
          <button
            onClick={() => setTab("dispositivos")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
              tab === "dispositivos" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Smartphone className="w-4 h-4" />
            Dispositivos
          </button>
          <button
            onClick={() => setTab("usuarios")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
              tab === "usuarios" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="w-4 h-4" />
            Usuários
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : tab === "dispositivos" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-amber-600">{pendentes.length}</p>
                <p className="text-xs font-medium text-amber-500 uppercase">Pendentes</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{autorizados.length}</p>
                <p className="text-xs font-medium text-green-500 uppercase">Autorizados</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{bloqueados.length}</p>
                <p className="text-xs font-medium text-red-500 uppercase">Bloqueados</p>
              </div>
            </div>

            {pendentes.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wide">Pendentes</h3>
                {pendentes.map(d => (
                  <DeviceCard key={d.id} device={d} getIcon={getDeviceIcon}
                    onAutorizar={() => handleUpdateDevice(d.id, "autorizado", d.device_label)}
                    onBloquear={() => handleUpdateDevice(d.id, "bloqueado", d.device_label)}
                    onRemover={() => handleDeleteDevice(d.id)}
                  />
                ))}
              </div>
            )}

            {autorizados.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-green-600 uppercase tracking-wide">Autorizados</h3>
                {autorizados.map(d => (
                  <DeviceCard key={d.id} device={d} getIcon={getDeviceIcon}
                    onBloquear={() => handleUpdateDevice(d.id, "bloqueado", d.device_label)}
                    onRemover={() => handleDeleteDevice(d.id)}
                  />
                ))}
              </div>
            )}

            {bloqueados.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-red-600 uppercase tracking-wide">Bloqueados</h3>
                {bloqueados.map(d => (
                  <DeviceCard key={d.id} device={d} getIcon={getDeviceIcon}
                    onAutorizar={() => handleUpdateDevice(d.id, "autorizado", d.device_label)}
                    onRemover={() => handleDeleteDevice(d.id)}
                  />
                ))}
              </div>
            )}

            {dispositivos.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Smartphone className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Nenhum dispositivo registrado.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setShowForm(!showForm)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#1c3654] to-[#2a5080] text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                <UserPlus className="w-4 h-4" />
                {showForm ? "Cancelar" : "Adicionar Usuário"}
              </button>
            </div>

            {showForm && (
              <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50 space-y-4">
                <h2 className="font-bold text-lg">Novo Usuário - Luana 2026</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">E-mail</label>
                    <input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} placeholder="email@exemplo.com"
                      className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background text-foreground" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Nome</label>
                    <input type="text" value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome completo"
                      className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background text-foreground" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Senha</label>
                    <input type="text" value={novoSenha} onChange={e => setNovoSenha(e.target.value)} placeholder="Senha do Luana 2026"
                      className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background text-foreground" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Permissão</label>
                    <select value={novoRole} onChange={e => setNovoRole(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background text-foreground">
                      <option value="colaborador">Colaborador</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>
                <button onClick={handleAddUser} disabled={saving}
                  className="px-8 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar Usuário
                </button>
              </div>
            )}

            <div className="space-y-3">
              {usuarios.map(u => (
                <div key={u.id} className={cn(
                  "bg-card rounded-2xl shadow-sm border p-5 flex items-center justify-between gap-4",
                  u.role === "admin" ? "border-blue-200" : "border-border/50",
                  !u.active && "opacity-60"
                )}>
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
                      u.role === "admin" ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"
                    )}>
                      {u.role === "admin" ? <Shield className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate flex items-center gap-2">
                        {u.name}
                        {u.role === "admin" && (
                          <span className="text-[10px] font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Admin</span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                      <p className="text-xs text-muted-foreground">Criado: {u.criado_em}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleUpdateUser(u.id, { role: u.role === "admin" ? "colaborador" : "admin" })}
                      className={cn(
                        "px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5",
                        u.role === "admin" ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      {u.role === "admin" ? "Admin" : "Usuário"}
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u.id, u.name)}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {usuarios.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>Nenhum usuário cadastrado.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function DeviceCard({ device, getIcon, onAutorizar, onBloquear, onRemover }: {
  device: LuanaDevice;
  getIcon: (ua: string) => React.ReactNode;
  onAutorizar?: () => void;
  onBloquear?: () => void;
  onRemover: () => void;
}) {
  const statusColor = device.status === "autorizado" ? "text-green-600" : device.status === "bloqueado" ? "text-red-500" : "text-amber-500";

  return (
    <div className={cn(
      "bg-card rounded-xl shadow-sm border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3",
      device.status === "autorizado" ? "border-green-200" : device.status === "bloqueado" ? "border-red-200" : "border-amber-300 bg-amber-50/30"
    )}>
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-1 text-muted-foreground flex-shrink-0">
          {getIcon(device.user_agent)}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{device.device_label || "Dispositivo"}</p>
          <p className="text-xs text-muted-foreground">IP: {device.ip_address}</p>
          <p className="text-xs text-muted-foreground">Registrado: {device.criado_em}</p>
          {device.autorizado_em && (
            <p className="text-xs text-green-600">Autorizado: {device.autorizado_em}</p>
          )}
          <span className={cn("text-[10px] font-bold uppercase tracking-wider", statusColor)}>
            {device.status}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {onAutorizar && device.status !== "autorizado" && (
          <button onClick={onAutorizar}
            className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" />
            Autorizar
          </button>
        )}
        {onBloquear && device.status !== "bloqueado" && (
          <button onClick={onBloquear}
            className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1">
            <Ban className="w-3.5 h-3.5" />
            Bloquear
          </button>
        )}
        <button onClick={onRemover}
          className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
