import { Link, useLocation } from "wouter";
import { Scale, Users, FileText, Search, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Busca de Clientes", icon: Search },
    { href: "/novo", label: "Novo Cliente", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row w-full">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <Scale className="h-6 w-6 text-accent" />
          <span className="font-display font-bold text-lg tracking-wide">Mendes Advocacia</span>
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
        <div className="p-8 hidden md:flex flex-col items-center border-b border-primary-foreground/10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-amber-600 flex items-center justify-center shadow-lg shadow-accent/20 mb-4">
            <Scale className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display font-bold text-xl tracking-wider text-center">Mendes<br/>Advocacia</h1>
        </div>

        <nav className="flex-1 py-8 px-4 space-y-2">
          {navItems.map((item) => {
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
        </nav>

        <div className="p-4 border-t border-primary-foreground/10">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-foreground/5">
            <div className="w-8 h-8 rounded-full bg-primary-foreground/10 flex items-center justify-center">
              <span className="font-bold text-sm text-accent">MA</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Dr. Marcos</span>
              <span className="text-xs text-primary-foreground/50">Administrador</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 animate-fade-in relative">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl -z-10 pointer-events-none" />
          {children}
        </div>
      </main>
    </div>
  );
}
