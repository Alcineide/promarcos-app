import { Layout } from "@/components/layout";
import { useState } from "react";

interface PesquisaResult {
  local: string;
  mensagem: string;
}

interface ActionCard {
  href: string;
  title: string;
  desc: string;
  tag: string;
  colorClass: string;
  icon: React.ReactNode;
  tagColor: string;
}

const cards: ActionCard[] = [
  {
    href: "https://marcosaurelio.app.n8n.cloud/form/69606561-f9fd-49b9-aca8-78924cf25b28",
    title: "Agendar reserva de carro",
    desc: "Solicite a reserva de um veículo informando o período, destino e acompanhante.",
    tag: "Reserva",
    colorClass: "reserva",
    tagColor: "bg-blue-500/15 text-blue-300",
    icon: (
      <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
        <rect x="3" y="5" width="22" height="20" rx="3" stroke="#60a5fa" strokeWidth="1.8" fill="none"/>
        <rect x="3" y="5" width="22" height="7" rx="3" fill="rgba(59,130,246,0.25)" stroke="#60a5fa" strokeWidth="1.8"/>
        <line x1="9" y1="3" x2="9" y2="8" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"/>
        <line x1="19" y1="3" x2="19" y2="8" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="9"  cy="17" r="1.2" fill="#93c5fd"/>
        <circle cx="14" cy="17" r="1.2" fill="#93c5fd"/>
        <circle cx="19" cy="17" r="1.2" fill="#93c5fd"/>
        <circle cx="9"  cy="21.5" r="1.2" fill="#93c5fd"/>
        <circle cx="14" cy="21.5" r="1.2" fill="#93c5fd"/>
        <circle cx="19" cy="21.5" r="1.2" fill="#3b82f6"/>
      </svg>
    ),
  },
  {
    href: "https://marcosaurelio.app.n8n.cloud/form/9ce0c797-66d5-400e-a4aa-5b32db4197bc",
    title: "Check-in — Retirada do carro",
    desc: "Registre a KM inicial e avarias aparentes ao retirar o veículo.",
    tag: "Check-in",
    colorClass: "checkin",
    tagColor: "bg-emerald-500/15 text-emerald-300",
    icon: (
      <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
        <path d="M2 17 L2 20 L5 20 M5 20 L23 20 M23 20 L26 20 L26 17 L24 17" stroke="#34d399" strokeWidth="1.7" strokeLinecap="round" fill="none"/>
        <path d="M5 17 L6.5 13 Q7.5 11 9.5 11 L18.5 11 Q20.5 11 21.5 13 L23 17" stroke="#34d399" strokeWidth="1.7" strokeLinecap="round" fill="none"/>
        <rect x="9" y="11.5" width="4" height="4" rx="0.8" fill="rgba(16,185,129,0.2)" stroke="#34d399" strokeWidth="1.2"/>
        <rect x="15" y="11.5" width="4" height="4" rx="0.8" fill="rgba(16,185,129,0.2)" stroke="#34d399" strokeWidth="1.2"/>
        <circle cx="8"  cy="20" r="2.5" stroke="#34d399" strokeWidth="1.6" fill="rgba(16,185,129,0.15)"/>
        <circle cx="20" cy="20" r="2.5" stroke="#34d399" strokeWidth="1.6" fill="rgba(16,185,129,0.15)"/>
        <line x1="18" y1="6" x2="26" y2="6" stroke="#10b981" strokeWidth="2" strokeLinecap="round"/>
        <polyline points="23,3.5 26,6 23,8.5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
  },
  {
    href: "https://marcosaurelio.app.n8n.cloud/form/21d8688e-d39c-4a80-b2ac-7c8be21e012b",
    title: "Check-out — Devolução do carro",
    desc: "Registre a KM final, avarias, necessidade de lavagem e manutenção.",
    tag: "Check-out",
    colorClass: "checkout",
    tagColor: "bg-amber-500/15 text-amber-300",
    icon: (
      <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
        <path d="M2 17 L2 20 L5 20 M5 20 L23 20 M23 20 L26 20 L26 17 L24 17" stroke="#fbbf24" strokeWidth="1.7" strokeLinecap="round" fill="none"/>
        <path d="M5 17 L6.5 13 Q7.5 11 9.5 11 L18.5 11 Q20.5 11 21.5 13 L23 17" stroke="#fbbf24" strokeWidth="1.7" strokeLinecap="round" fill="none"/>
        <rect x="9"  y="11.5" width="4" height="4" rx="0.8" fill="rgba(245,158,11,0.2)" stroke="#fbbf24" strokeWidth="1.2"/>
        <rect x="15" y="11.5" width="4" height="4" rx="0.8" fill="rgba(245,158,11,0.2)" stroke="#fbbf24" strokeWidth="1.2"/>
        <circle cx="8"  cy="20" r="2.5" stroke="#fbbf24" strokeWidth="1.6" fill="rgba(245,158,11,0.15)"/>
        <circle cx="20" cy="20" r="2.5" stroke="#fbbf24" strokeWidth="1.6" fill="rgba(245,158,11,0.15)"/>
        <line x1="10" y1="6" x2="2" y2="6" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
        <polyline points="5,3.5 2,6 5,8.5" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
  },
  {
    href: "https://marcosaurelio.app.n8n.cloud/form/1b1319ca-5a9e-4ff3-bc10-fb910a7dcfa0",
    title: "Prestação de Contas",
    desc: "Registre despesas, reembolsos e justificativas de uso do veículo.",
    tag: "Financeiro",
    colorClass: "prestacao",
    tagColor: "bg-purple-500/15 text-purple-300",
    icon: (
      <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
        <rect x="5" y="3" width="18" height="22" rx="3" stroke="#c084fc" strokeWidth="1.8" fill="none"/>
        <rect x="8" y="6" width="12" height="5" rx="1.5" fill="rgba(168,85,247,0.25)" stroke="#c084fc" strokeWidth="1.2"/>
        <line x1="14" y1="9.5" x2="18.5" y2="9.5" stroke="#d8b4fe" strokeWidth="1.2" strokeLinecap="round"/>
        <rect x="8"    y="14" width="3.5" height="3" rx="1" fill="rgba(168,85,247,0.3)"/>
        <rect x="12.3" y="14" width="3.5" height="3" rx="1" fill="rgba(168,85,247,0.3)"/>
        <rect x="16.5" y="14" width="3.5" height="3" rx="1" fill="rgba(168,85,247,0.5)"/>
        <rect x="8"    y="18.5" width="3.5" height="3" rx="1" fill="rgba(168,85,247,0.3)"/>
        <rect x="12.3" y="18.5" width="3.5" height="3" rx="1" fill="rgba(168,85,247,0.3)"/>
        <rect x="16.5" y="18.5" width="3.5" height="3" rx="1" fill="rgba(168,85,247,0.5)"/>
      </svg>
    ),
  },
];

const colorMap: Record<string, { border: string; bg: string; glow: string; arrow: string }> = {
  reserva:  { border: "hover:border-blue-500/40",   bg: "hover:bg-blue-500/5",   glow: "bg-blue-500/5",   arrow: "group-hover:text-blue-400" },
  checkin:  { border: "hover:border-emerald-500/40", bg: "hover:bg-emerald-500/5", glow: "bg-emerald-500/5", arrow: "group-hover:text-emerald-400" },
  checkout: { border: "hover:border-amber-500/40",   bg: "hover:bg-amber-500/5",   glow: "bg-amber-500/5",   arrow: "group-hover:text-amber-400" },
  prestacao:{ border: "hover:border-purple-500/40",  bg: "hover:bg-purple-500/5",  glow: "bg-purple-500/5",  arrow: "group-hover:text-purple-400" },
};

const iconBg: Record<string, string> = {
  reserva:  "bg-blue-500/15",
  checkin:  "bg-emerald-500/15",
  checkout: "bg-amber-500/15",
  prestacao:"bg-purple-500/15",
};

export default function Veiculos() {
  const [cpf, setCpf] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [resultados, setResultados] = useState<PesquisaResult[]>([]);
  const [pesquisando, setPesquisando] = useState(false);
  const [pesquisaFeita, setPesquisaFeita] = useState(false);

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
    if (!cpf.trim()) return;
    setPesquisando(true);
    setPesquisaFeita(false);
    await new Promise((r) => setTimeout(r, 1200));
    setResultados([]);
    setPesquisaFeita(true);
    setPesquisando(false);
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto py-4">

        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/25 text-blue-300 text-xs font-medium tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Sistema de gestão
          </span>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-2">
            Gestão de <span className="text-accent">Frota</span>
          </h1>
          <p className="text-muted-foreground text-sm">Selecione abaixo o que deseja fazer</p>
        </div>

        <div className="flex flex-col gap-3.5">
          {cards.map((card) => {
            const c = colorMap[card.colorClass];
            return (
              <a
                key={card.href}
                href={card.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex items-center gap-5 bg-card border border-border rounded-2xl px-5 py-5 transition-all duration-200 hover:-translate-y-0.5 ${c.border} ${c.bg}`}
              >
                <div className={`w-13 h-13 rounded-2xl flex items-center justify-center flex-shrink-0 p-3 ${iconBg[card.colorClass]}`}>
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-base text-foreground mb-0.5">{card.title}</div>
                  <div className="text-sm text-muted-foreground leading-snug mb-2">{card.desc}</div>
                  <span className={`inline-block text-[10px] font-semibold tracking-widest uppercase px-2.5 py-0.5 rounded-full ${card.tagColor}`}>
                    {card.tag}
                  </span>
                </div>
                <span className={`text-muted-foreground text-lg transition-all duration-200 group-hover:translate-x-1 flex-shrink-0 ${c.arrow}`}>→</span>
              </a>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground/40 mt-8">
          Preencha o formulário correspondente à sua ação
        </p>

        <div className="mt-10 border-t border-border pt-8">
          <div className="mb-6 text-center">
            <span className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/25 text-green-300 text-xs font-medium tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.867-3.834zm-5.44.306a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/>
              </svg>
              Consulta
            </span>
            <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-foreground mb-2">
              Pesquisa <span className="text-green-400">CPF</span>
            </h2>
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
                      placeholder="dd/mm/aaaa"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50"
                    />
                  </div>

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

                <div className="min-h-[200px]">
                  {resultados.length > 0 ? (
                    resultados.map((r, i) => (
                      <div key={i} className="grid grid-cols-[1fr_2fr] border-b border-border last:border-b-0">
                        <div className="px-4 py-3 text-sm text-foreground border-r border-border">{r.local}</div>
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

      </div>
    </Layout>
  );
}
