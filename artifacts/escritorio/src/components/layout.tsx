import { Link, useLocation } from "wouter";
import { Users, Search, Menu, X, CalendarCheck, LogIn, LogOut, Receipt, FileSearch } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const internalNavItems = [
  { href: "/", label: "Busca de Clientes", icon: Search },
  { href: "/novo", label: "Novo Cliente", icon: Users },
];

const frotaItems = [
  {
    label: "Reserva",
    icon: CalendarCheck,
    href: "https://marcosaurelio.app.n8n.cloud/form/69606561-f9fd-49b9-aca8-78924cf25b28",
    color: "text-blue-400",
    hoverBg: "hover:bg-blue-500/10",
    dot: "bg-blue-400",
  },
  {
    label: "Check-in Retirada",
    icon: LogOut,
    href: "https://marcosaurelio.app.n8n.cloud/form/9ce0c797-66d5-400e-a4aa-5b32db4197bc",
    color: "text-emerald-400",
    hoverBg: "hover:bg-emerald-500/10",
    dot: "bg-emerald-400",
  },
  {
    label: "Check-in Entrega",
    icon: LogIn,
    href: "https://marcosaurelio.app.n8n.cloud/form/21d8688e-d39c-4a80-b2ac-7c8be21e012b",
    color: "text-amber-400",
    hoverBg: "hover:bg-amber-500/10",
    dot: "bg-amber-400",
  },
  {
    label: "Prestação de Contas",
    icon: Receipt,
    href: "https://marcosaurelio.app.n8n.cloud/form/1b1319ca-5a9e-4ff3-bc10-fb910a7dcfa0",
    color: "text-purple-400",
    hoverBg: "hover:bg-purple-500/10",
    dot: "bg-purple-400",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row w-full">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-primary text-primary-foreground">
        <div className="flex items-center gap-3">
          <img
            src="/logo-promarcos.png"
            alt="Promarcos"
            className="w-9 h-9 rounded-xl object-cover shadow-lg"
          />
          <span className="font-display font-bold text-lg tracking-wide">Promarcos - Clientes</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "bg-primary text-primary-foreground w-full md:w-72 flex-shrink-0 flex-col z-50",
          "md:flex md:static absolute inset-y-0 left-0 transform transition-transform duration-300 ease-in-out",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="p-8 hidden md:flex flex-col items-center border-b border-primary-foreground/10">
          <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-xl shadow-black/30 mb-4 bg-[#2a4a7a] flex items-center justify-center">
            <img
              src="/logo-promarcos.png"
              alt="Promarcos"
              className="w-[150%] h-[150%] object-cover"
              style={{ objectPosition: "50% 52%", marginTop: "8px" }}
            />
          </div>
          <h1 className="font-display font-bold text-xl tracking-wider text-center leading-tight">
            Promarcos<br/>
            <span className="text-sm font-normal text-primary-foreground/70 tracking-widest uppercase">Clientes</span>
          </h1>
        </div>

        <nav className="flex-1 py-6 px-4 overflow-y-auto">
          {/* Clientes section */}
          <div className="mb-1">
            <p className="px-4 mb-2 text-[10px] font-semibold tracking-widest uppercase text-primary-foreground/30">
              Clientes
            </p>
            <div className="space-y-1">
              {internalNavItems.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 group",
                      isActive
                        ? "bg-primary-foreground/10 text-accent"
                        : "text-primary-foreground/70 hover:bg-primary-foreground/5 hover:text-primary-foreground"
                    )}
                  >
                    <item.icon className={cn("h-5 w-5", isActive ? "text-accent" : "text-primary-foreground/50 group-hover:text-primary-foreground/80")} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-primary-foreground/10" />

          {/* Frota section */}
          <div>
            <p className="px-4 mb-2 text-[10px] font-semibold tracking-widest uppercase text-primary-foreground/30">
              Frota de Veículos
            </p>
            <div className="space-y-1">
              {frotaItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 group",
                    "text-primary-foreground/70 hover:text-primary-foreground",
                    item.hoverBg
                  )}
                >
                  <item.icon className={cn("h-5 w-5 text-primary-foreground/40 group-hover:scale-110 transition-transform", `group-hover:${item.color}`)} />
                  <span className="flex-1">{item.label}</span>
                  <span className={cn("w-1.5 h-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity", item.dot)} />
                </a>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-primary-foreground/10" />

          {/* Pesquisa CPF */}
          <div>
            <p className="px-4 mb-2 text-[10px] font-semibold tracking-widest uppercase text-primary-foreground/30">
              Pesquisa
            </p>
            <div className="space-y-1">
              <Link
                href="/pesquisa-cpf"
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 group",
                  location === "/pesquisa-cpf"
                    ? "bg-primary-foreground/10 text-accent"
                    : "text-primary-foreground/70 hover:bg-primary-foreground/5 hover:text-primary-foreground"
                )}
              >
                <FileSearch className={cn("h-5 w-5", location === "/pesquisa-cpf" ? "text-accent" : "text-primary-foreground/50 group-hover:text-primary-foreground/80")} />
                Pesquisa CPF
              </Link>
            </div>
          </div>

        </nav>

        <div className="p-4 border-t border-primary-foreground/10">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-foreground/5">
            <img
              src="/logo-promarcos.png"
              alt="Promarcos"
              className="w-8 h-8 rounded-full object-cover"
            />
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Promarcos</span>
              <span className="text-xs text-primary-foreground/50">Sistema de Gestão Jurídica</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 animate-fade-in relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl -z-10 pointer-events-none" />
          {children}
        </div>
      </main>
    </div>
  );
}
