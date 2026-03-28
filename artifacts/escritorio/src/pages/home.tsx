import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Search, UserPlus, ChevronRight, FileText, Briefcase, MapPin, AlertCircle } from "lucide-react";
import { useListClientes } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { formatCPF } from "@/lib/utils";
import { buscarPorCpf, type PromarkosPessoa } from "@/lib/promarcos-api";
import { cn } from "@/lib/utils";

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [promarkosResult, setPromarkosResult] = useState<{ existe: boolean; pessoa?: PromarkosPessoa } | null>(null);
  const [promarkosLoading, setPromarkosLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const { data: clients, isLoading } = useListClientes({ search: searchTerm });

  useEffect(() => {
    const digits = searchTerm.replace(/\D/g, "");
    if (digits.length !== 11) {
      setPromarkosResult(null);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setPromarkosLoading(true);
      try {
        const result = await buscarPorCpf(digits);
        setPromarkosResult(result.existe && result.pessoas.length > 0 ? { existe: true, pessoa: result.pessoas[0] } : { existe: false });
      } catch {
        setPromarkosResult(null);
      } finally {
        setPromarkosLoading(false);
      }
    }, 600);
  }, [searchTerm]);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-primary mb-2">Consulta de Clientes</h1>
            <p className="text-muted-foreground text-lg">Busque por clientes cadastrados ou inicie um novo cadastro.</p>
          </div>
          <Link
            href="/novo"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-200"
          >
            <UserPlus className="w-5 h-5" />
            Novo Cliente
          </Link>
        </header>

        <div className="bg-card rounded-2xl p-4 md:p-6 shadow-sm border border-border/50 space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            {promarkosLoading && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
            <input
              type="text"
              placeholder="Buscar por Nome ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200 text-lg"
            />
          </div>

          {/* Promarcos result when CPF typed */}
          {promarkosResult?.existe && promarkosResult.pessoa && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-blue-50 border-2 border-blue-200 overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-4 border-b border-blue-200">
                <div>
                  <p className="text-xs font-bold text-blue-500 uppercase tracking-wider">Cadastro encontrado no Promarcos</p>
                  <p className="font-bold text-blue-900 text-xl mt-0.5">{promarkosResult.pessoa.razao_social}</p>
                </div>
                <Link
                  href={`/novo?cpf=${promarkosResult.pessoa.cpf.replace(/\D/g, "")}`}
                  className="flex-shrink-0 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Abrir Cadastro
                </Link>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm text-blue-800">
                <div><span className="font-semibold text-blue-500 text-xs uppercase">CPF</span><p>{promarkosResult.pessoa.cpf}</p></div>
                {promarkosResult.pessoa.nascimento && (
                  <div><span className="font-semibold text-blue-500 text-xs uppercase">Nascimento</span>
                  <p>{new Date(promarkosResult.pessoa.nascimento).toLocaleDateString("pt-BR")}</p></div>
                )}
                {promarkosResult.pessoa.sexo && (
                  <div><span className="font-semibold text-blue-500 text-xs uppercase">Sexo</span><p>{promarkosResult.pessoa.sexo === "M" ? "Masculino" : "Feminino"}</p></div>
                )}
                {promarkosResult.pessoa.estado_civil && (
                  <div><span className="font-semibold text-blue-500 text-xs uppercase">Estado Civil</span><p>{promarkosResult.pessoa.estado_civil}</p></div>
                )}
                {promarkosResult.pessoa.profissao && (
                  <div><span className="font-semibold text-blue-500 text-xs uppercase">Profissão</span><p>{promarkosResult.pessoa.profissao}</p></div>
                )}
                {promarkosResult.pessoa.rg && (
                  <div><span className="font-semibold text-blue-500 text-xs uppercase">RG</span><p>{promarkosResult.pessoa.rg}</p></div>
                )}
                {promarkosResult.pessoa.telefone1 && (
                  <div><span className="font-semibold text-blue-500 text-xs uppercase">Telefone</span><p>{promarkosResult.pessoa.telefone1}</p></div>
                )}
                {promarkosResult.pessoa.email1 && (
                  <div><span className="font-semibold text-blue-500 text-xs uppercase">E-mail</span><p>{promarkosResult.pessoa.email1}</p></div>
                )}
                {(promarkosResult.pessoa.logradouro || promarkosResult.pessoa.cidade) && (
                  <div className="md:col-span-2">
                    <span className="font-semibold text-blue-500 text-xs uppercase">Endereço</span>
                    <p>
                      {[promarkosResult.pessoa.logradouro, promarkosResult.pessoa.numero, promarkosResult.pessoa.bairro].filter(Boolean).join(", ")}
                      {promarkosResult.pessoa.cidade && ` — ${promarkosResult.pessoa.cidade}/${promarkosResult.pessoa.estado}`}
                    </p>
                  </div>
                )}
                {promarkosResult.pessoa.cep && (
                  <div><span className="font-semibold text-blue-500 text-xs uppercase">CEP</span><p>{promarkosResult.pessoa.cep}</p></div>
                )}
              </div>
            </motion.div>
          )}
          {promarkosResult?.existe === false && searchTerm.replace(/\D/g, "").length === 11 && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="px-4 py-3 rounded-xl bg-muted/60 border border-border text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              CPF não encontrado no Promarcos. Você pode cadastrá-lo agora.
            </motion.div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold px-2">
            {isLoading ? "Buscando..." : `Resultados no sistema local (${clients?.length || 0})`}
          </h2>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-card rounded-2xl p-6 h-32 animate-pulse border border-border/50" />
              ))}
            </div>
          ) : clients?.length === 0 ? (
            <div className="bg-card rounded-3xl p-12 text-center border border-border/50 shadow-sm flex flex-col items-center">
              <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-6">
                <Search className="w-10 h-10 text-primary/40" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Nenhum cliente encontrado</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Não conseguimos encontrar nenhum cliente com estes termos. Verifique a ortografia ou cadastre um novo cliente.
              </p>
              <Link
                href="/novo"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-all duration-200"
              >
                Cadastrar novo cliente
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {clients?.map((client, index) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={client.id}
                >
                  <Link
                    href={`/cliente/${client.id}`}
                    className="block bg-card rounded-2xl p-6 shadow-sm border border-border/60 hover:shadow-md hover:border-primary/30 transition-all duration-300 group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-1">{client.nomeCompleto}</h3>
                        <p className="text-sm font-medium text-muted-foreground mt-1 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          {formatCPF(client.cpf)}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                        <ChevronRight className="w-5 h-5 text-primary/40 group-hover:text-white" />
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-border/50 flex gap-4 text-xs text-muted-foreground">
                      {client.cidade && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {client.cidade}/{client.estado}
                        </span>
                      )}
                      {client.escritorio && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          {client.escritorio}
                        </span>
                      )}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
