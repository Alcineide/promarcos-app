import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { Shield, ShieldCheck, UserPlus, Trash2, Loader2, Crown, UserCog, ToggleLeft, ToggleRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Usuario {
  id: number;
  email: string;
  nome: string;
  role: string;
  isSuperAdmin: boolean;
  ativo: boolean;
  createdAt?: string;
}

export default function AdminUsuarios() {
  const { user, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [novoEmail, setNovoEmail] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoRole, setNovoRole] = useState("user");
  const [showForm, setShowForm] = useState(false);

  const fetchUsuarios = useCallback(async () => {
    try {
      const res = await fetch("/api/usuarios", {
        headers: { "x-user-email": user?.email || "" },
      });
      if (res.ok) {
        setUsuarios(await res.json());
      } else {
        toast({ title: "Erro", description: "Não foi possível carregar os usuários.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao conectar com o servidor.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user?.email, toast]);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  const handleAdd = async () => {
    if (!novoEmail.trim() || !novoNome.trim()) {
      toast({ title: "Atenção", description: "Preencha o e-mail e o nome.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": user?.email || "",
        },
        body: JSON.stringify({ email: novoEmail.trim(), nome: novoNome.trim(), role: novoRole }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Sucesso", description: "Usuário adicionado." });
        setNovoEmail("");
        setNovoNome("");
        setNovoRole("user");
        setShowForm(false);
        await fetchUsuarios();
      } else {
        toast({ title: "Erro", description: data.error || "Falha ao adicionar.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao conectar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRole = async (u: Usuario) => {
    const newRole = u.role === "admin" ? "user" : "admin";
    try {
      const res = await fetch(`/api/usuarios/${u.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": user?.email || "",
        },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Sucesso", description: `${u.nome} agora é ${newRole === "admin" ? "Administrador" : "Usuário comum"}.` });
        await fetchUsuarios();
      } else {
        toast({ title: "Erro", description: data.error || "Falha ao alterar.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao conectar.", variant: "destructive" });
    }
  };

  const handleToggleAtivo = async (u: Usuario) => {
    try {
      const res = await fetch(`/api/usuarios/${u.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": user?.email || "",
        },
        body: JSON.stringify({ ativo: !u.ativo }),
      });
      if (res.ok) {
        toast({ title: "Sucesso", description: `${u.nome} foi ${u.ativo ? "desativado" : "ativado"}.` });
        await fetchUsuarios();
      } else {
        const data = await res.json();
        toast({ title: "Erro", description: data.error || "Falha ao alterar status.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao conectar.", variant: "destructive" });
    }
  };

  const handleDelete = async (u: Usuario) => {
    if (!confirm(`Deseja remover ${u.nome} (${u.email})?`)) return;
    try {
      const res = await fetch(`/api/usuarios/${u.id}`, {
        method: "DELETE",
        headers: { "x-user-email": user?.email || "" },
      });
      if (res.ok) {
        toast({ title: "Sucesso", description: "Usuário removido." });
        await fetchUsuarios();
      } else {
        const data = await res.json();
        toast({ title: "Erro", description: data.error || "Falha ao remover.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao conectar.", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-primary mb-2 flex items-center gap-3">
              <ShieldCheck className="w-8 h-8" />
              Gerenciar Usuários
            </h1>
            <p className="text-muted-foreground text-lg">
              {isSuperAdmin
                ? "Gerencie os acessos e permissões de administradores."
                : "Visualize os usuários do sistema."}
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-[#1c3654] to-[#2a5080] text-white shadow-lg shadow-[#1c3654]/20 hover:shadow-xl hover:shadow-[#1c3654]/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-200"
          >
            <UserPlus className="w-5 h-5" />
            {showForm ? "Cancelar" : "Adicionar Usuário"}
          </button>
        </header>

        {showForm && (
          <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50 space-y-4">
            <h2 className="font-bold text-lg">Novo Usuário</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">E-mail</label>
                <input
                  type="email"
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Nome</label>
                <input
                  type="text"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background text-foreground"
                />
              </div>
            </div>
            {isSuperAdmin && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Permissão</label>
                <select
                  value={novoRole}
                  onChange={(e) => setNovoRole(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background text-foreground"
                >
                  <option value="user">Usuário comum</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            )}
            <button
              onClick={handleAdd}
              disabled={saving}
              className="px-8 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar Usuário
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {usuarios.map((u) => (
              <div
                key={u.id}
                className={cn(
                  "bg-card rounded-2xl p-5 shadow-sm border transition-all",
                  u.isSuperAdmin
                    ? "border-amber-300 bg-amber-50/50"
                    : u.role === "admin"
                    ? "border-blue-200"
                    : "border-border/50",
                  !u.ativo && "opacity-60"
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
                        u.isSuperAdmin
                          ? "bg-amber-500 text-white"
                          : u.role === "admin"
                          ? "bg-blue-500 text-white"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {u.isSuperAdmin ? (
                        <Crown className="w-5 h-5" />
                      ) : u.role === "admin" ? (
                        <Shield className="w-5 h-5" />
                      ) : (
                        <UserCog className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate flex items-center gap-2">
                        {u.nome}
                        {u.isSuperAdmin && (
                          <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Super Admin
                          </span>
                        )}
                        {u.role === "admin" && !u.isSuperAdmin && (
                          <span className="text-[10px] font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Admin
                          </span>
                        )}
                        {!u.ativo && (
                          <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Inativo
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>

                  {!u.isSuperAdmin && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isSuperAdmin && (
                        <button
                          onClick={() => handleToggleRole(u)}
                          title={u.role === "admin" ? "Remover admin" : "Tornar admin"}
                          className={cn(
                            "px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5",
                            u.role === "admin"
                              ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}
                        >
                          <Shield className="w-3.5 h-3.5" />
                          {u.role === "admin" ? "Admin" : "Usuário"}
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleAtivo(u)}
                        title={u.ativo ? "Desativar" : "Ativar"}
                        className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                      >
                        {u.ativo ? (
                          <ToggleRight className="w-5 h-5 text-green-500" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-red-400" />
                        )}
                      </button>
                      {isSuperAdmin && (
                        <button
                          onClick={() => handleDelete(u)}
                          title="Remover usuário"
                          className="p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {usuarios.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Nenhum usuário cadastrado ainda.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
