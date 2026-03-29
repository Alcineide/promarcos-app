import { Link, useLocation } from "wouter";
import { Users, Search, Menu, X, CalendarCheck, LogIn, LogOut, Receipt, FileSearch, Download, Power, ShieldCheck, Activity, Monitor } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const internalNavItems = [
  { href: "/novo", label: "Novo Cliente", icon: Users },
];

const frotaItems = [
  {
    label: "Reserva",
    icon: CalendarCheck,
    href: "https://marcosaurelio.app.n8n.cloud/form/69606561-f9fd-49b9-aca8-78924cf25b28",
  },
  {
    label: "Check-in Retirada",
    icon: LogOut,
    href: "https://marcosaurelio.app.n8n.cloud/form/9ce0c797-66d5-400e-a4aa-5b32db4197bc",
  },
  {
    label: "Check-in Entrega",
    icon: LogIn,
    href: "https://marcosaurelio.app.n8n.cloud/form/21d8688e-d39c-4a80-b2ac-7c8be21e012b",
  },
  {
    label: "Prestação de Contas",
    icon: Receipt,
    href: "https://marcosaurelio.app.n8n.cloud/form/1b1319ca-5a9e-4ff3-bc10-fb910a7dcfa0",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row w-full">
      <div className="md:hidden flex items-center justify-between p-4 bg-[#1c3654] text-white shadow-lg">
        <div className="flex items-center gap-3">
          <img
            src="/logo-promarcos.png"
            alt="Mendes Advocacia"
            className="w-10 h-10 rounded-xl object-cover"
          />
          <span className="font-display font-bold text-lg tracking-wide">Promarcos - Clientes</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <aside
        className={cn(
          "w-full md:w-[280px] flex-shrink-0 flex-col z-50",
          "md:flex md:static absolute inset-y-0 left-0 transform transition-transform duration-300 ease-in-out",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        style={{
          background: "linear-gradient(180deg, #1a2e45 0%, #1c3654 40%, #234060 100%)",
        }}
      >
        <div className="p-6 hidden md:flex flex-col items-center">
          <div className="w-28 h-28 rounded-2xl overflow-hidden mb-3 bg-[#4a7aab]/20 flex items-center justify-center shadow-2xl shadow-black/40 border border-white/5">
            <img
              src="/logo-promarcos.png"
              alt="Mendes Advocacia"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="font-display font-bold text-[17px] tracking-wide text-center text-white/95 leading-tight">
            Promarcos
          </h1>
          <p className="text-[10px] font-medium text-[#6ba3d6] tracking-[0.2em] uppercase mt-1">Clientes</p>
        </div>

        <div className="mx-4 border-t border-white/[0.06]" />

        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <div className="mb-5">
            <p className="px-3 mb-2 text-[10px] font-bold tracking-[0.15em] uppercase text-[#5b9bd5]">
              Clientes
            </p>
            <div className="space-y-0.5">
              {internalNavItems.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 group",
                      isActive
                        ? "bg-[#5b9bd5]/15 text-[#8ec5ff] shadow-sm shadow-[#5b9bd5]/10"
                        : "text-white/60 hover:bg-white/[0.04] hover:text-white/90"
                    )}
                  >
                    <item.icon className={cn("h-[18px] w-[18px]", isActive ? "text-[#5b9bd5]" : "text-white/30 group-hover:text-[#5b9bd5]/70")} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mx-1 mb-5 border-t border-white/[0.06]" />

          <div className="mb-5">
            <p className="px-3 mb-2 text-[10px] font-bold tracking-[0.15em] uppercase text-amber-400/70">
              Frota de Veículos
            </p>
            <div className="space-y-0.5">
              {frotaItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 group text-white/60 hover:bg-white/[0.04] hover:text-white/90"
                >
                  <item.icon className="h-[18px] w-[18px] text-white/30 group-hover:text-amber-400/70" />
                  <span className="flex-1">{item.label}</span>
                  <span className="w-1 h-1 rounded-full bg-amber-400/0 group-hover:bg-amber-400/60 transition-colors" />
                </a>
              ))}
            </div>
          </div>

          <div className="mx-1 mb-5 border-t border-white/[0.06]" />

          <div>
            <p className="px-3 mb-2 text-[10px] font-bold tracking-[0.15em] uppercase text-emerald-400/70">
              Pesquisa
            </p>
            <div className="space-y-0.5">
              <Link
                href="/pesquisa-cpf"
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 group",
                  location === "/pesquisa-cpf"
                    ? "bg-emerald-500/15 text-emerald-300 shadow-sm shadow-emerald-500/10"
                    : "text-white/60 hover:bg-white/[0.04] hover:text-white/90"
                )}
              >
                <FileSearch className={cn("h-[18px] w-[18px]", location === "/pesquisa-cpf" ? "text-emerald-400" : "text-white/30 group-hover:text-emerald-400/70")} />
                Pesquisa de Litispendência
              </Link>
            </div>
          </div>
        </nav>

        {isAdmin && (
          <div className="px-3 pb-2">
            <div className="mx-1 mb-3 border-t border-white/[0.06]" />
            <p className="px-3 mb-2 text-[10px] font-bold tracking-[0.15em] uppercase text-red-400/70">
              Administração
            </p>
            <div className="space-y-0.5">
              <Link
                href="/admin/usuarios"
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 group",
                  location === "/admin/usuarios"
                    ? "bg-red-500/15 text-red-300 shadow-sm shadow-red-500/10"
                    : "text-white/60 hover:bg-white/[0.04] hover:text-white/90"
                )}
              >
                <ShieldCheck className={cn("h-[18px] w-[18px]", location === "/admin/usuarios" ? "text-red-400" : "text-white/30 group-hover:text-red-400/70")} />
                Gerenciar Usuários
              </Link>
              <Link
                href="/admin/auditoria"
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 group",
                  location === "/admin/auditoria"
                    ? "bg-red-500/15 text-red-300 shadow-sm shadow-red-500/10"
                    : "text-white/60 hover:bg-white/[0.04] hover:text-white/90"
                )}
              >
                <Activity className={cn("h-[18px] w-[18px]", location === "/admin/auditoria" ? "text-red-400" : "text-white/30 group-hover:text-red-400/70")} />
                Auditoria
              </Link>
              <Link
                href="/admin/luana2026"
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 group",
                  location === "/admin/luana2026"
                    ? "bg-red-500/15 text-red-300 shadow-sm shadow-red-500/10"
                    : "text-white/60 hover:bg-white/[0.04] hover:text-white/90"
                )}
              >
                <Monitor className={cn("h-[18px] w-[18px]", location === "/admin/luana2026" ? "text-red-400" : "text-white/30 group-hover:text-red-400/70")} />
                Luana 2026
              </Link>
              <button
                onClick={async () => {
                  setIsMobileMenuOpen(false);
                  try {
                    const res = await fetch(`${import.meta.env.BASE_URL}api/download-projeto`, {
                      headers: { "x-user-email": user?.email || "" },
                    });
                    if (!res.ok) return;
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "mendes-advocacia-projeto-completo.json";
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch {}
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 group text-white/60 hover:bg-white/[0.04] hover:text-white/90 w-full text-left"
              >
                <Download className="h-[18px] w-[18px] text-white/30 group-hover:text-red-400/70" />
                Baixar Projeto
              </button>
            </div>
          </div>
        )}

        <div className="p-3 space-y-2">
          <div className="mx-1 border-t border-white/[0.06] mb-2" />
          <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-white/[0.03]">
            <div className="w-8 h-8 rounded-lg bg-[#4a7aab]/30 flex items-center justify-center text-white/80 font-bold text-xs">
              {user?.nome?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <span className="text-xs font-semibold text-white/80 truncate">{user?.nome || "Usuário"}</span>
              <span className="text-[10px] text-white/35 truncate">{user?.email || ""}</span>
            </div>
            <button
              onClick={logout}
              title="Sair"
              className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Power className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 animate-fade-in relative">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#5b9bd5]/[0.03] rounded-full blur-3xl -z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#1c3654]/[0.03] rounded-full blur-3xl -z-10 pointer-events-none" />
          {children}
        </div>
      </main>
    </div>
  );
}
