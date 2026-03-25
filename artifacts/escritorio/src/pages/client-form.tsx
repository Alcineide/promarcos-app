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
  const [novoProcesso, setNovoProcesso] = useState({ numero: "", vara: "", comarca: "", assunto: "", status: "Ativo" });

  const handleCreateProcesso = async () => {
    try {
      await createProcesso.mutateAsync({ id: clientId, data: novoProcesso });
      toast({ title: "Sucesso", description: "Processo adicionado!" });
      setProcessoModalOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/clientes/${clientId}/processos`] });
    } catch {
      toast({ title: "Erro", description: "Falha ao criar processo", variant: "destructive" });
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
                  <Briefcase className="w-5 h-5 text-primary" /> Processos do Cliente
                </h2>
                <button 
                  type="button"
                  onClick={() => setProcessoModalOpen(true)}
                  className="px-4 py-2 bg-primary/10 text-primary font-bold rounded-lg hover:bg-primary/20 transition-colors"
                >
                  + Novo Processo
                </button>
              </div>

              {processos?.length === 0 ? (
                <div className="bg-card p-12 text-center rounded-2xl border border-border/50 border-dashed">
                  <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground font-medium">Nenhum processo cadastrado para este cliente.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {processos?.map(p => (
                    <div key={p.id} className="bg-card p-5 rounded-2xl shadow-sm border border-border/50 flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-primary/30 transition-colors">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-lg">{p.numero || "Sem número"}</h3>
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-xs font-bold",
                            p.status === "Ativo" ? "bg-green-100 text-green-700" :
                            p.status === "Suspenso" ? "bg-amber-100 text-amber-700" :
                            "bg-slate-100 text-slate-700"
                          )}>
                            {p.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {p.vara} • {p.comarca}
                        </p>
                        <p className="text-sm font-medium mt-1">Assunto: {p.assunto}</p>
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

      {/* Modal Novo Processo */}
      <AnimatePresence>
        {isProcessoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-border">
              <div className="p-6 border-b border-border/50">
                <h3 className="text-xl font-bold">Cadastrar Novo Processo</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Número do Processo</label>
                  <input type="text" value={novoProcesso.numero} onChange={e => setNovoProcesso(p => ({...p, numero: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Vara</label>
                    <input type="text" value={novoProcesso.vara} onChange={e => setNovoProcesso(p => ({...p, vara: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Comarca</label>
                    <input type="text" value={novoProcesso.comarca} onChange={e => setNovoProcesso(p => ({...p, comarca: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Assunto</label>
                  <input type="text" value={novoProcesso.assunto} onChange={e => setNovoProcesso(p => ({...p, assunto: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Status</label>
                  <select value={novoProcesso.status} onChange={e => setNovoProcesso(p => ({...p, status: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-background">
                    <option value="Ativo">Ativo</option>
                    <option value="Suspenso">Suspenso</option>
                    <option value="Arquivado">Arquivado</option>
                  </select>
                </div>
              </div>
              <div className="p-4 bg-muted/30 flex justify-end gap-3">
                <button type="button" onClick={() => setProcessoModalOpen(false)} className="px-4 py-2.5 font-semibold text-muted-foreground hover:bg-muted rounded-xl transition-colors">Cancelar</button>
                <button type="button" onClick={handleCreateProcesso} className="px-6 py-2.5 font-bold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">Salvar Processo</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </Layout>
  );
}
