import { useState, useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  User, Phone, MapPin, FileText, FolderOpen, Save, 
  ArrowLeft, CheckCircle2, Copy, FilePlus2, DownloadCloud, Trash2, Briefcase
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { cn, formatCEP, formatCPF, formatPhone } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { 
  useGetCliente, 
  useCreateCliente, 
  useUpdateCliente,
  useListProcessos,
  useCreateProcesso,
  useListAnexos,
  useCreateAnexo,
  useDeleteAnexo,
  getGetClienteQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

// --- Schemas ---
const clientSchema = z.object({
  escritorio: z.string().min(1, "Obrigatório"),
  cpf: z.string().min(11, "CPF inválido"),
  nomeCompleto: z.string().min(3, "Nome muito curto"),
  dataNascimento: z.string().optional().nullable(),
  sexo: z.string().optional().nullable(),
  estadoCivil: z.string().optional().nullable(),
  rgRepresentante: z.string().optional().nullable(),
  orgaoEmissor: z.string().optional().nullable(),
  profissao: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email: z.string().email("E-mail inválido").or(z.literal("")).optional().nullable(),
  cep: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  observacao: z.string().optional().nullable(),
  pastaPath: z.string().optional().nullable(),
});

type ClientFormData = z.infer<typeof clientSchema>;

export default function ClientForm() {
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id && id !== "novo");
  const clientId = parseInt(id || "0");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"cadastro" | "processos" | "documentos">("cadastro");

  // --- API Hooks ---
  const { data: clientData, isLoading: isLoadingClient } = useGetCliente(clientId, { query: { enabled: isEditing }});
  const createClient = useCreateCliente();
  const updateClient = useUpdateCliente();

  const { data: processos } = useListProcessos(clientId, { query: { enabled: isEditing }});
  const createProcesso = useCreateProcesso();

  const { data: anexos } = useListAnexos(clientId, { query: { enabled: isEditing }});
  const createAnexo = useCreateAnexo();
  const deleteAnexo = useDeleteAnexo();

  // --- Form Setup ---
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: { escritorio: "Mendes Advocacia - Matriz" }
  });

  useEffect(() => {
    if (clientData) {
      reset(clientData as ClientFormData);
    }
  }, [clientData, reset]);

  // --- Masks & External API ---
  const cepValue = watch("cep");
  useEffect(() => {
    const rawCep = cepValue?.replace(/\D/g, "") || "";
    if (rawCep.length === 8) {
      fetch(`https://viacep.com.br/ws/${rawCep}/json/`)
        .then(res => res.json())
        .then(data => {
          if (!data.erro) {
            setValue("logradouro", data.logradouro);
            setValue("bairro", data.bairro);
            setValue("cidade", data.localidade);
            setValue("estado", data.uf);
            toast({ title: "Endereço preenchido!", description: "Dados do CEP carregados com sucesso." });
          }
        });
    }
  }, [cepValue, setValue, toast]);

  // --- Handlers ---
  const onSubmit = async (data: ClientFormData) => {
    try {
      if (isEditing) {
        await updateClient.mutateAsync({ id: clientId, data });
        toast({ title: "Sucesso", description: "Cliente atualizado com sucesso!" });
      } else {
        const newClient = await createClient.mutateAsync({ data });
        toast({ title: "Sucesso", description: "Cliente criado com sucesso!" });
        setLocation(`/cliente/${newClient.id}`);
      }
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível salvar o cliente.", variant: "destructive" });
    }
  };

  const openFolder = () => {
    const path = watch("pastaPath");
    if (!path) return toast({ title: "Atenção", description: "Caminho da pasta não definido.", variant: "destructive" });
    
    try {
      window.open(`file:///${path.replace(/\\/g, '/')}`);
    } catch (e) {
      toast({ title: "Bloqueado pelo Navegador", description: "Copie o caminho para abrir no explorador de arquivos.", variant: "destructive" });
    }
  };

  const copyPath = () => {
    const path = watch("pastaPath");
    if (path) {
      navigator.clipboard.writeText(path);
      toast({ title: "Copiado!", description: "Caminho copiado para a área de transferência." });
    }
  };

  // --- Local State for Documents ---
  const [generatedDocs, setGeneratedDocs] = useState<{name: string, date: Date}[]>([]);
  const generateDoc = (name: string) => {
    setGeneratedDocs(prev => [{ name, date: new Date() }, ...prev]);
    toast({ title: "Documento Gerado", description: `${name} gerado com sucesso.` });
  };

  const [isProcessoModalOpen, setProcessoModalOpen] = useState(false);
  const [editingProcesso, setEditingProcesso] = useState<any>(null);
  const emptyProcesso = { numeroPasta: "", numeroProcesso: "", dataEntrada: "", fluxo: "Analise", estagio: "Triagem", urgencia: false, observacoes: "", fatoGerador: "", matricula: "", dataFatoGerador: "", escritorioProcesso: "Mendes Advocacia - Araguaína - A", beneficio: "AÇÃO CÍVEL", tipoBeneficio: "TODAS", status: "Ativo", cadastradoPor: "" };
  const [novoProcesso, setNovoProcesso] = useState<any>(emptyProcesso);

  const openProcessoModal = (processo?: any) => {
    if (processo) {
      setEditingProcesso(processo);
      setNovoProcesso({ ...emptyProcesso, ...processo });
    } else {
      setEditingProcesso(null);
      setNovoProcesso(emptyProcesso);
    }
    setProcessoModalOpen(true);
  };

  const handleCreateProcesso = async () => {
    try {
      if (editingProcesso) {
        await updateProcesso.mutateAsync({ id: editingProcesso.id, data: novoProcesso });
        toast({ title: "Sucesso", description: "Processo atualizado!" });
      } else {
        await createProcesso.mutateAsync({ id: clientId, data: novoProcesso });
        toast({ title: "Sucesso", description: "Processo adicionado!" });
      }
      setProcessoModalOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/clientes/${clientId}/processos`] });
    } catch {
      toast({ title: "Erro", description: "Falha ao salvar processo", variant: "destructive" });
    }
  };

  const handleFileUpload = async (tipo: string) => {
    // Mocking file selection
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          await createAnexo.mutateAsync({ 
            id: clientId, 
            data: { tipo, nomeArquivo: file.name, fileData: "base64mock..." } 
          });
          toast({ title: "Upload Completo", description: `${file.name} anexado.` });
          queryClient.invalidateQueries({ queryKey: [`/api/clientes/${clientId}/anexos`] });
        } catch {
          toast({ title: "Erro", description: "Falha no upload", variant: "destructive" });
        }
      }
    };
    input.click();
  };

  if (isEditing && isLoadingClient) {
    return <Layout><div className="flex justify-center p-20"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div></Layout>;
  }

  const InputField = ({ label, name, maskFn, ...props }: any) => (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-foreground/80">{label}</label>
      <input
        {...register(name)}
        onChange={(e) => {
          if (maskFn) e.target.value = maskFn(e.target.value);
          register(name).onChange(e);
        }}
        className={cn(
          "w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200",
          errors[name] && "border-destructive focus:border-destructive focus:ring-destructive/10"
        )}
        {...props}
      />
      {errors[name] && <span className="text-xs text-destructive font-medium">{(errors[name] as any).message}</span>}
    </div>
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto pb-24">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-display font-bold text-primary">
                {isEditing ? "Editar Cliente" : "Novo Cadastro"}
              </h1>
              {isEditing && <p className="text-muted-foreground">ID: #{clientId} • {clientData?.nomeCompleto}</p>}
            </div>
          </div>
          
          <button 
            onClick={handleSubmit(onSubmit)}
            disabled={createClient.isPending || updateClient.isPending}
            className="hidden md:flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
          >
            <Save className="w-5 h-5" />
            Salvar Cliente
          </button>
        </header>

        {/* Tabs */}
        <div className="flex space-x-1 bg-muted/50 p-1.5 rounded-2xl mb-8 overflow-x-auto">
          {[
            { id: "cadastro", label: "Dados Cadastrais" },
            { id: "processos", label: "Processos", disabled: !isEditing },
            { id: "documentos", label: "Docs e Anexos", disabled: !isEditing },
          ].map(tab => (
            <button
              key={tab.id}
              disabled={tab.disabled}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 px-6 py-3 rounded-xl font-medium text-sm transition-all whitespace-nowrap",
                activeTab === tab.id 
                  ? "bg-white text-primary shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-white/50",
                tab.disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form id="client-form" onSubmit={handleSubmit(onSubmit)}>
          {activeTab === "cadastro" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Escritório */}
              <div className="bg-card p-6 md:p-8 rounded-2xl shadow-sm border border-border/50">
                <div className="max-w-md">
                  <InputField label="Escritório Responsável *" name="escritorio" placeholder="Ex: Matriz, Filial..." />
                </div>
              </div>

              {/* Dados Pessoais */}
              <div className="bg-card p-6 md:p-8 rounded-2xl shadow-sm border border-border/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 text-primary/5 pointer-events-none">
                  <User className="w-32 h-32" />
                </div>
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                  <User className="w-5 h-5 text-primary" /> Dados Pessoais
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                  <InputField label="CPF *" name="cpf" maskFn={formatCPF} placeholder="000.000.000-00" />
                  <div className="lg:col-span-2">
                    <InputField label="Nome Completo *" name="nomeCompleto" placeholder="Nome do cliente" />
                  </div>
                  <InputField label="Data de Nascimento" name="dataNascimento" type="date" />
                  
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-foreground/80">Sexo</label>
                    <select {...register("sexo")} className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10">
                      <option value="">Selecione...</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-foreground/80">Estado Civil</label>
                    <select {...register("estadoCivil")} className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10">
                      <option value="">Selecione...</option>
                      <option value="Solteiro">Solteiro(a)</option>
                      <option value="Casado">Casado(a)</option>
                      <option value="Divorciado">Divorciado(a)</option>
                      <option value="Viúvo">Viúvo(a)</option>
                      <option value="União Estável">União Estável</option>
                    </select>
                  </div>

                  <InputField label="RG/Representante" name="rgRepresentante" />
                  <InputField label="Órgão Emissor" name="orgaoEmissor" />
                  <div className="lg:col-span-2">
                    <InputField label="Profissão" name="profissao" />
                  </div>
                </div>
              </div>

              {/* Contato */}
              <div className="bg-card p-6 md:p-8 rounded-2xl shadow-sm border border-border/50">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                  <Phone className="w-5 h-5 text-primary" /> Contato
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputField label="Telefone / Celular" name="telefone" maskFn={formatPhone} placeholder="(00) 00000-0000" />
                  <InputField label="E-mail" name="email" type="email" placeholder="cliente@email.com" />
                </div>
              </div>

              {/* Endereço */}
              <div className="bg-card p-6 md:p-8 rounded-2xl shadow-sm border border-border/50">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                  <MapPin className="w-5 h-5 text-primary" /> Endereço
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <InputField label="CEP" name="cep" maskFn={formatCEP} placeholder="00000-000" />
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-foreground/80">Estado (UF)</label>
                    <select {...register("estado")} className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10">
                      <option value="">UF</option>
                      <option value="AC">AC - Acre</option>
                      <option value="AL">AL - Alagoas</option>
                      <option value="AP">AP - Amapá</option>
                      <option value="AM">AM - Amazonas</option>
                      <option value="BA">BA - Bahia</option>
                      <option value="CE">CE - Ceará</option>
                      <option value="DF">DF - Distrito Federal</option>
                      <option value="ES">ES - Espírito Santo</option>
                      <option value="GO">GO - Goiás</option>
                      <option value="MA">MA - Maranhão</option>
                      <option value="MT">MT - Mato Grosso</option>
                      <option value="MS">MS - Mato Grosso do Sul</option>
                      <option value="MG">MG - Minas Gerais</option>
                      <option value="PA">PA - Pará</option>
                      <option value="PB">PB - Paraíba</option>
                      <option value="PR">PR - Paraná</option>
                      <option value="PE">PE - Pernambuco</option>
                      <option value="PI">PI - Piauí</option>
                      <option value="RJ">RJ - Rio de Janeiro</option>
                      <option value="RN">RN - Rio Grande do Norte</option>
                      <option value="RS">RS - Rio Grande do Sul</option>
                      <option value="RO">RO - Rondônia</option>
                      <option value="RR">RR - Roraima</option>
                      <option value="SC">SC - Santa Catarina</option>
                      <option value="SP">SP - São Paulo</option>
                      <option value="SE">SE - Sergipe</option>
                      <option value="TO">TO - Tocantins</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <InputField label="Cidade" name="cidade" />
                  </div>
                  
                  <div className="md:col-span-2">
                    <InputField label="Logradouro" name="logradouro" placeholder="Rua, Avenida..." />
                  </div>
                  <InputField label="Número" name="numero" />
                  <InputField label="Complemento" name="complemento" />
                  
                  <div className="md:col-span-2">
                    <InputField label="Bairro" name="bairro" />
                  </div>
                  <div className="md:col-span-4 space-y-1.5">
                    <label className="text-sm font-semibold text-foreground/80">Observações de Endereço</label>
                    <textarea 
                      {...register("observacao")} 
                      className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 min-h-[100px] resize-y"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "processos" && isEditing && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex justify-between items-center bg-card p-6 rounded-2xl shadow-sm border border-border/50">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary" /> Pastas / Processos do Cliente
                </h2>
                <button 
                  type="button"
                  onClick={() => openProcessoModal()}
                  className="px-4 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-lg shadow-primary/20"
                >
                  + Nova Pasta
                </button>
              </div>

              {processos?.length === 0 ? (
                <div className="bg-card p-12 text-center rounded-2xl border border-border/50 border-dashed">
                  <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground font-medium">Nenhum processo cadastrado para este cliente.</p>
                  <button type="button" onClick={() => openProcessoModal()} className="mt-4 px-6 py-2.5 bg-primary/10 text-primary font-semibold rounded-xl hover:bg-primary/20 transition-colors">+ Abrir Nova Pasta</button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {processos?.map(p => (
                    <div key={p.id} className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden hover:border-primary/30 transition-colors">
                      {/* Card Header */}
                      <div className="p-5 border-b border-border/50">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-lg uppercase">{p.beneficio} {p.tipoBeneficio}</h3>
                            {p.numeroPasta && (
                              <span className="inline-flex items-center mt-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary text-primary-foreground">
                                Pasta {p.numeroPasta}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-bold",
                              p.status === "Ativo" ? "bg-green-100 text-green-700 border border-green-200" :
                              p.status === "JUD:Protocolado" ? "bg-red-500 text-white" :
                              p.status === "Suspenso" ? "bg-amber-100 text-amber-700 border border-amber-200" :
                              p.status === "Arquivado" ? "bg-slate-100 text-slate-600 border border-slate-200" :
                              "bg-blue-100 text-blue-700 border border-blue-200"
                            )}>
                              {p.status}
                            </span>
                            {p.urgencia && <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">⚡ Urgente</span>}
                          </div>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                        <div><span className="font-semibold text-muted-foreground">Fato gerador: </span>{p.fatoGerador || "Sem fato gerador vinculado"}</div>
                        <div><span className="font-semibold text-muted-foreground">Matrícula: </span>{p.matricula || "Sem matrícula"}</div>
                        <div><span className="font-semibold text-muted-foreground">Data fato gerador: </span>{p.dataFatoGerador || "Não informada"}</div>
                        <div><span className="font-semibold text-muted-foreground">Número processo: </span>{p.numeroProcesso || "Sem número"}</div>
                        <div><span className="font-semibold text-muted-foreground">Data entrada: </span>{p.dataEntrada || "—"}</div>
                        <div><span className="font-semibold text-muted-foreground">Escritório: </span>{p.escritorioProcesso || "—"}</div>
                        {p.estagio && <div><span className="font-semibold text-muted-foreground">Estágio: </span>{p.estagio}</div>}
                        {p.fluxo && <div><span className="font-semibold text-muted-foreground">Fluxo: </span>{p.fluxo}</div>}
                        {p.cadastradoPor && <div className="md:col-span-2 text-xs text-muted-foreground pt-1 border-t border-border/50">Cadastrado em {new Date(p.createdAt).toLocaleDateString('pt-BR')} por {p.cadastradoPor}</div>}
                      </div>

                      {/* Card Actions */}
                      <div className="px-5 pb-5 flex flex-wrap gap-3">
                        <button type="button" onClick={() => generateDoc("Folha de Rosto")} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2">
                          <FileText className="w-4 h-4" /> Gerar Folha de Rosto
                        </button>
                        <button type="button" onClick={() => openProcessoModal(p)} className="px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                          ✏️ Editar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "documentos" && isEditing && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              
              {/* Pasta Local */}
              <div className="bg-gradient-to-br from-card to-secondary/30 p-6 md:p-8 rounded-2xl shadow-sm border border-border/50">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                  <FolderOpen className="w-5 h-5 text-accent" /> Pasta Local do Cliente
                </h2>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <InputField label="Caminho da Pasta (Local/Rede)" name="pastaPath" placeholder="Ex: C:\Escritorio\Clientes\João Silva" />
                  </div>
                  <div className="flex items-end gap-2 pt-2">
                    <button type="button" onClick={copyPath} className="px-5 py-3 rounded-xl font-semibold bg-background border-2 border-border hover:bg-muted transition-colors flex items-center gap-2">
                      <Copy className="w-4 h-4" /> Copiar
                    </button>
                    <button type="button" onClick={openFolder} className="px-5 py-3 rounded-xl font-semibold bg-accent text-accent-foreground shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors flex items-center gap-2">
                      <FolderOpen className="w-4 h-4" /> Abrir Pasta
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 
                  O botão "Abrir Pasta" tenta utilizar protocolos do navegador para abrir diretórios locais.
                </p>
              </div>

              {/* Documentos Digitais */}
              <div className="bg-card p-6 md:p-8 rounded-2xl shadow-sm border border-border/50">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" /> Gerar Documentos Digitais
                  </h2>
                  <button type="button" onClick={() => generateDoc("Pacote Completo")} className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors text-sm">
                    Gerar Todos
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {["Procuração Extra", "Contrato", "Declaração não incidência", "Declaração Hipossuficiência", "Termo de Risco", "Revogação"].map(doc => (
                    <button type="button" key={doc} onClick={() => generateDoc(doc)} className="p-4 rounded-xl border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/40 transition-all font-semibold flex flex-col items-center justify-center gap-2 text-center h-24">
                      <FilePlus2 className="w-6 h-6" />
                      <span className="text-sm leading-tight">{doc}</span>
                    </button>
                  ))}
                </div>

                {generatedDocs.length > 0 && (
                  <div className="mt-8 border-t border-border/50 pt-6">
                    <h3 className="font-bold mb-4">Documentos Gerados Recentemente</h3>
                    <div className="space-y-2">
                      {generatedDocs.map((doc, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <span className="font-medium text-sm">{doc.name}</span>
                          <span className="text-xs text-muted-foreground">{doc.date.toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Anexos */}
              <div className="bg-card p-6 md:p-8 rounded-2xl shadow-sm border border-border/50">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                  <DownloadCloud className="w-5 h-5 text-amber-600" /> Anexar Documentos
                </h2>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8">
                  {["Folha de rosto", "Procuração", "Docs Pessoais", "Residência", "Fato gerador", "Cert. Casamento", "Cert. Óbito", "Provas rurais", "Laudo médico", "Outros"].map(tipo => (
                    <button type="button" key={tipo} onClick={() => handleFileUpload(tipo)} className="p-4 rounded-xl border border-amber-500/20 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-500/40 transition-all font-semibold flex flex-col items-center justify-center gap-2 text-center h-24">
                      <DownloadCloud className="w-5 h-5" />
                      <span className="text-xs leading-tight">{tipo}</span>
                    </button>
                  ))}
                </div>

                <div className="border-t border-border/50 pt-6">
                  <h3 className="font-bold mb-4 text-lg">Arquivos Anexados</h3>
                  {anexos?.length === 0 ? (
                    <p className="text-muted-foreground text-sm italic">Nenhum anexo salvo no banco de dados.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {anexos?.map(anexo => (
                        <div key={anexo.id} className="flex items-center justify-between p-4 border border-border/60 rounded-xl bg-background">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            <div className="truncate">
                              <p className="font-semibold text-sm truncate">{anexo.nomeArquivo}</p>
                              <p className="text-xs text-muted-foreground">{anexo.tipo}</p>
                            </div>
                          </div>
                          <button 
                            type="button"
                            onClick={async () => {
                              await deleteAnexo.mutateAsync({ id: anexo.id });
                              queryClient.invalidateQueries({ queryKey: [`/api/clientes/${clientId}/anexos`] });
                            }} 
                            className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </motion.div>
          )}
        </form>

        {/* Floating Mobile Save Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border md:hidden z-40">
           <button 
            onClick={handleSubmit(onSubmit)}
            disabled={createClient.isPending || updateClient.isPending}
            className="w-full flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20"
          >
            <Save className="w-5 h-5" />
            Salvar Cliente
          </button>
        </div>
      </div>

      {/* Modal Novo / Editar Processo */}
      <AnimatePresence>
        {isProcessoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-border max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-border/50 bg-primary/5 flex-shrink-0">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary" />
                  {editingProcesso ? "Editar Processo" : "Novo / Abrir Pasta"}
                </h3>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto">
                {/* Linha 1 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Número do Processo</label>
                    <input type="text" value={novoProcesso.numeroProcesso} onChange={e => setNovoProcesso((p: any) => ({...p, numeroProcesso: e.target.value}))} placeholder="0000000-00.0000.0.00.0000" className="w-full px-4 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Data de Entrada</label>
                    <input type="date" value={novoProcesso.dataEntrada} onChange={e => setNovoProcesso((p: any) => ({...p, dataEntrada: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background" />
                  </div>
                </div>

                {/* Linha 2 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Fluxo</label>
                    <select value={novoProcesso.fluxo} onChange={e => setNovoProcesso((p: any) => ({...p, fluxo: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background">
                      <option value="Analise">Analise</option>
                      <option value="Judicial">Judicial</option>
                      <option value="Administrativo">Administrativo</option>
                      <option value="Recursal">Recursal</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Estágio</label>
                    <select value={novoProcesso.estagio} onChange={e => setNovoProcesso((p: any) => ({...p, estagio: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background">
                      <option value="Triagem">Triagem</option>
                      <option value="Protocolo">Protocolo</option>
                      <option value="Distribuído">Distribuído</option>
                      <option value="Em andamento">Em andamento</option>
                      <option value="Concluído">Concluído</option>
                    </select>
                  </div>
                </div>

                {/* Urgência */}
                <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-background">
                  <input type="checkbox" id="urgencia" checked={novoProcesso.urgencia} onChange={e => setNovoProcesso((p: any) => ({...p, urgencia: e.target.checked}))} className="w-5 h-5 rounded border-border accent-primary cursor-pointer" />
                  <label htmlFor="urgencia" className="font-semibold cursor-pointer text-foreground">⚡ Urgência</label>
                </div>

                {/* Fato Gerador */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Fato Gerador</label>
                  <input type="text" value={novoProcesso.fatoGerador} onChange={e => setNovoProcesso((p: any) => ({...p, fatoGerador: e.target.value}))} placeholder="Ex: MWB COM. DE MATERIAIS PARA CONSTRUCAO EIRELI" className="w-full px-4 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background" />
                </div>

                {/* Linha 3 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Matrícula</label>
                    <input type="text" value={novoProcesso.matricula} onChange={e => setNovoProcesso((p: any) => ({...p, matricula: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Data do Fato Gerador</label>
                    <input type="date" value={novoProcesso.dataFatoGerador} onChange={e => setNovoProcesso((p: any) => ({...p, dataFatoGerador: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background" />
                  </div>
                </div>

                {/* Linha 4 - Benefício */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Benefício</label>
                    <select value={novoProcesso.beneficio} onChange={e => setNovoProcesso((p: any) => ({...p, beneficio: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background">
                      <option value="AÇÃO CÍVEL">AÇÃO CÍVEL</option>
                      <option value="APOSENTADORIA">APOSENTADORIA</option>
                      <option value="AUXÍLIO-DOENÇA">AUXÍLIO-DOENÇA</option>
                      <option value="AUXÍLIO-ACIDENTE">AUXÍLIO-ACIDENTE</option>
                      <option value="BPC/LOAS">BPC/LOAS</option>
                      <option value="PENSÃO POR MORTE">PENSÃO POR MORTE</option>
                      <option value="SALÁRIO-MATERNIDADE">SALÁRIO-MATERNIDADE</option>
                      <option value="REVISÃO DE BENEFÍCIO">REVISÃO DE BENEFÍCIO</option>
                      <option value="OUTROS">OUTROS</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Tipo Benefício</label>
                    <select value={novoProcesso.tipoBeneficio} onChange={e => setNovoProcesso((p: any) => ({...p, tipoBeneficio: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background">
                      <option value="TODAS">TODAS</option>
                      <option value="RURAL">RURAL</option>
                      <option value="URBANO">URBANO</option>
                      <option value="MISTO">MISTO</option>
                      <option value="HÍBRIDO">HÍBRIDO</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Nº Pasta</label>
                    <input type="text" value={novoProcesso.numeroPasta} onChange={e => setNovoProcesso((p: any) => ({...p, numeroPasta: e.target.value}))} placeholder="Ex: 005398" className="w-full px-4 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background" />
                  </div>
                </div>

                {/* Escritório */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Escritório</label>
                  <select value={novoProcesso.escritorioProcesso} onChange={e => setNovoProcesso((p: any) => ({...p, escritorioProcesso: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background">
                    <option value="Mendes Advocacia - Araguaína - A">Mendes Advocacia - Araguaína - A</option>
                    <option value="Mendes Advocacia - Matriz">Mendes Advocacia - Matriz</option>
                    <option value="Mendes Advocacia - Filial">Mendes Advocacia - Filial</option>
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Status / Situação</label>
                  <select value={novoProcesso.status} onChange={e => setNovoProcesso((p: any) => ({...p, status: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background">
                    <option value="Ativo">Ativo</option>
                    <option value="JUD:Protocolado">JUD:Protocolado</option>
                    <option value="Em análise">Em análise</option>
                    <option value="Suspenso">Suspenso</option>
                    <option value="Arquivado">Arquivado</option>
                    <option value="Encerrado">Encerrado</option>
                  </select>
                </div>

                {/* Cadastrado por */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Cadastrado Por</label>
                  <input type="text" value={novoProcesso.cadastradoPor} onChange={e => setNovoProcesso((p: any) => ({...p, cadastradoPor: e.target.value}))} placeholder="Nome do responsável" className="w-full px-4 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background" />
                </div>

                {/* Observações */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Observações do Processo</label>
                  <textarea value={novoProcesso.observacoes} onChange={e => setNovoProcesso((p: any) => ({...p, observacoes: e.target.value}))} rows={3} className="w-full px-4 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background resize-none" />
                </div>
              </div>

              <div className="p-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 flex-shrink-0">
                <button type="button" onClick={() => setProcessoModalOpen(false)} className="px-5 py-2.5 font-semibold text-muted-foreground hover:bg-muted rounded-xl transition-colors">Cancelar</button>
                <button type="button" onClick={handleCreateProcesso} className="px-8 py-2.5 font-bold bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors shadow-lg">Salvar Processo</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </Layout>
  );
}
