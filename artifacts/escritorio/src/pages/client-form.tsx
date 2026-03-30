import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useParams, useSearch, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { buscarPorCpf, buscarEscritorios, salvarPessoa, buscarProcessos, buscarBeneficios, buscarBeneficioTipos, criarProcessoPromarcos, editarProcessoPromarcos, gerarFolhaRosto, uploadArquivoPromarcos, buscarSocio, buscarIndicadoresProcesso, adicionarIndicador, removerIndicador, buscarSociosProcesso, adicionarSocio, removerSocio, type PromarkosPessoa, type PromarkosProcesso, type PromarkosEscritorio, type PromarkosBeneficio, type PromarkosBeneficioTipo, type ProcessoIndicador, type ProcessoSocioParsed, type BuscarSocioResult } from "@/lib/promarcos-api";
import { 
  User, Phone, MapPin, FileText, FolderOpen, Save, 
  ArrowLeft, CheckCircle2, Copy, FilePlus2, DownloadCloud, Trash2, Briefcase, Loader2, RefreshCw, ExternalLink,
  Camera, ImageIcon, X, Upload, CheckCircle, WifiOff
} from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useSyncQueue } from "@/lib/sync-context";
import { addPendingSubmission } from "@/lib/offline-db";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { FormInput } from "@/components/form-input";
import { DocumentScanner } from "@/components/DocumentScanner";
import { cn, formatCEP, formatCPF, formatPhone, formatDate } from "@/lib/utils";
import { registrarAuditoria } from "@/lib/audit-service";
import { useToast } from "@/hooks/use-toast";
import { 
  useGetCliente, 
  useCreateCliente, 
  useUpdateCliente,
  useListProcessos,
  useCreateProcesso,
  useUpdateProcesso,
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
  dataNascimento: z.string().min(1, "Data de nascimento obrigatória"),
  sexo: z.string().min(1, "Obrigatório"),
  estadoCivil: z.string().min(1, "Obrigatório"),
  rgRepresentante: z.string().optional().nullable(),
  orgaoEmissor: z.string().optional().nullable(),
  profissao: z.string().min(1, "Obrigatório"),
  telefone: z.string().min(1, "Obrigatório"),
  telefone2: z.string().optional().nullable(),
  email: z.string().email("E-mail inválido").or(z.literal("")).optional().nullable(),
  cep: z.string().min(8, "CEP inválido"),
  estado: z.string().min(1, "Obrigatório"),
  cidade: z.string().min(1, "Obrigatório"),
  logradouro: z.string().min(1, "Obrigatório"),
  numero: z.string().min(1, "Obrigatório"),
  complemento: z.string().optional().nullable(),
  bairro: z.string().min(1, "Obrigatório"),
  observacao: z.string().optional().nullable(),
  pastaPath: z.string().optional().nullable(),
});

type ClientFormData = z.infer<typeof clientSchema>;

export default function ClientForm() {
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();
  const search = useSearch();
  const cpfFromUrl = useMemo(() => new URLSearchParams(search).get("cpf") || "", [search]);
  const isEditing = Boolean(id && id !== "novo");
  const clientId = parseInt(id || "0");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isOnline = useOnlineStatus();
  const { refreshQueue } = useSyncQueue();

  const [activeTab, setActiveTab] = useState<"cadastro" | "processos" | "documentos">("cadastro");
  const [scannerModal, setScannerModal] = useState<{ tipo: string; tipoSlug: string } | null>(null);
  const [capturedFiles, setCapturedFiles] = useState<File[]>([]);
  const [capturedPreviews, setCapturedPreviews] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [promarkosPreloaded, setPromarkosPreloaded] = useState(false);
  const [promarcosCodigo, setPromarcosCodigo] = useState<number | null>(null);
  const [promarkosProcessos, setPromarkosProcessos] = useState<PromarkosProcesso[]>([]);
  const [loadingPromarkosProcessos, setLoadingPromarkosProcessos] = useState(false);
  const [beneficios, setBeneficios] = useState<PromarkosBeneficio[]>([]);
  const [beneficioTipos, setBeneficioTipos] = useState<PromarkosBeneficioTipo[]>([]);
  const [isPromarkosProcessoModalOpen, setPromarkosProcessoModalOpen] = useState(false);
  const [editingPromarkosProcesso, setEditingPromarkosProcesso] = useState<PromarkosProcesso | null>(null);
  const [showObservacoes, setShowObservacoes] = useState(false);
  const [processoIndicadores, setProcessoIndicadores] = useState<ProcessoIndicador[]>([]);
  const [processoSocios, setProcessoSocios] = useState<ProcessoSocioParsed[]>([]);
  const [loadingComissoes, setLoadingComissoes] = useState(false);
  const [novoIndTermo, setNovoIndTermo] = useState("");
  const [novoIndResultados, setNovoIndResultados] = useState<BuscarSocioResult[]>([]);
  const [novoIndSelecionado, setNovoIndSelecionado] = useState<BuscarSocioResult | null>(null);
  const [novoIndPercentual, setNovoIndPercentual] = useState<number>(0);
  const [adicionandoInd, setAdicionandoInd] = useState(false);
  const [novoSocioTermo, setNovoSocioTermo] = useState("");
  const [novoSocioResultados, setNovoSocioResultados] = useState<BuscarSocioResult[]>([]);
  const [novoSocioSelecionado, setNovoSocioSelecionado] = useState<BuscarSocioResult | null>(null);
  const [novoSocioPercentual, setNovoSocioPercentual] = useState<number>(0);
  const [adicionandoSocio, setAdicionandoSocio] = useState(false);
  const emptyPromarkosProcesso = {
    escritorioid: 0,
    beneficioid_categoria: 0,
    beneficioid: 0,
    dataentrada: new Date().toISOString().split("T")[0],
    urgencia: false,
    modo: "novo",
    numeroprocesso: "",
    fluxo: "Analise",
    estagio: "Triagem",
    observacoes: "",
    fatogerador: "",
    terrapropia: false,
    incra: false,
    vinculoemprego: "",
    numeropasta: "",
    percentualIndicador: 0,
    percentualSocio: 0,
    usuariocadastro: 32,
  };
  const [gerandoFolha, setGerandoFolha] = useState<number | null>(null);
  const [novoPromarkosProcesso, setNovoPromarkosProcesso] = useState<typeof emptyPromarkosProcesso>(emptyPromarkosProcesso);

  // --- Promarcos escritórios ---
  const [empresas, setEmpresas] = useState<PromarkosEscritorio[]>([]);
  useEffect(() => {
    buscarEscritorios().then(setEmpresas);
  }, []);

  // --- Promarcos CPF check state ---
  const [cpfCheckResult, setCpfCheckResult] = useState<{ existe: boolean; pessoa?: PromarkosPessoa } | null>(null);
  const [cpfChecking, setCpfChecking] = useState(false);
  const cpfTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- API Hooks ---
  // @ts-expect-error queryKey auto-generated by hook
  const { data: clientData, isLoading: isLoadingClient } = useGetCliente(clientId, { query: { enabled: isEditing } });
  const createClient = useCreateCliente();
  const updateClient = useUpdateCliente();

  // @ts-expect-error queryKey auto-generated by hook
  const { data: processos } = useListProcessos(clientId, { query: { enabled: isEditing } });
  const createProcesso = useCreateProcesso();
  const updateProcesso = useUpdateProcesso();

  // @ts-expect-error queryKey auto-generated by hook
  const { data: anexos } = useListAnexos(clientId, { query: { enabled: isEditing } });
  const createAnexo = useCreateAnexo();
  const deleteAnexo = useDeleteAnexo();

  // --- Form Setup ---
  const { register, handleSubmit, setValue, watch, reset, getValues, formState: { errors } } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: { escritorio: "Mendes Advocacia - Matriz" }
  });

  const auditedRef = useRef(false);
  useEffect(() => {
    if (clientData && isEditing && !auditedRef.current) {
      auditedRef.current = true;
      registrarAuditoria({
        tipo_acao: "consulta",
        cpf_consultado: clientData.cpf,
      });
    }
  }, [clientData, isEditing]);

  useEffect(() => {
    if (clientData) {
      reset(clientData as ClientFormData);
      if ((clientData as any).promarcosCodigo) {
        setPromarcosCodigo((clientData as any).promarcosCodigo);
      } else if (clientData.cpf && navigator.onLine) {
        const cpfNums = clientData.cpf.replace(/\D/g, "");
        if (cpfNums.length === 11) {
          buscarPorCpf(cpfNums).then(result => {
            if (result.existe && result.pessoas.length > 0) {
              setPromarcosCodigo(result.pessoas[0].codigo);
            }
          }).catch(() => {});
        }
      }
    }
  }, [clientData, reset]);

  useEffect(() => {
    if (clientData?.escritorio && empresas.length > 0) {
      setValue("escritorio", clientData.escritorio);
    }
  }, [clientData?.escritorio, empresas, setValue]);

  useEffect(() => {
    if (promarkosPreloaded && empresas.length > 0) {
      const current = getValues("escritorio");
      const isValid = empresas.some(e => e.nome === current);
      if (!current || !isValid) {
        const araguaina = empresas.find(e => e.nome.toLowerCase().includes("araguaín") || e.nome.toLowerCase().includes("araguain"));
        setValue("escritorio", araguaina?.nome || empresas[0].nome);
      }
    }
  }, [promarkosPreloaded, empresas, setValue, getValues]);

  useEffect(() => {
    capturedPreviews.forEach(url => URL.revokeObjectURL(url));
    setCapturedFiles([]);
    setCapturedPreviews([]);
    setUploadDone(false);
    setUploadingFiles(false);
  }, [scannerModal]);

  const fetchPromarkosProcessos = async (codigo: number) => {
    setLoadingPromarkosProcessos(true);
    try {
      const lista = await buscarProcessos(codigo);
      setPromarkosProcessos(lista);
    } finally {
      setLoadingPromarkosProcessos(false);
    }
  };

  useEffect(() => {
    if (promarcosCodigo) {
      fetchPromarkosProcessos(promarcosCodigo);
    }
  }, [promarcosCodigo]);

  const estadoCivilMap: Record<string, string> = {
    "Solteiro": "Solteiro", "Solteiro(a)": "Solteiro", "solteiro": "Solteiro",
    "Casado": "Casado", "Casado(a)": "Casado", "casado": "Casado",
    "Divorciado": "Divorciado", "Divorciado(a)": "Divorciado", "divorciado": "Divorciado",
    "Viúvo": "Viúvo", "Viúvo(a)": "Viúvo", "viúvo": "Viúvo", "Viuvo": "Viúvo", "Viuvo(a)": "Viúvo",
    "União Estável": "União Estável", "União estável": "União Estável", "união estável": "União Estável", "Uniao Estavel": "União Estável",
  };
  const estadoMap: Record<string, string> = {
    "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM", "Bahia": "BA",
    "Ceará": "CE", "Distrito Federal": "DF", "Espírito Santo": "ES", "Goiás": "GO",
    "Maranhão": "MA", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS", "Minas Gerais": "MG",
    "Pará": "PA", "Paraíba": "PB", "Paraná": "PR", "Pernambuco": "PE", "Piauí": "PI",
    "Rio de Janeiro": "RJ", "Rio Grande do Norte": "RN", "Rio Grande do Sul": "RS",
    "Rondônia": "RO", "Roraima": "RR", "Santa Catarina": "SC", "São Paulo": "SP",
    "Sergipe": "SE", "Tocantins": "TO",
  };

  const fillFormFromPromarcos = (p: PromarkosPessoa, cpfRaw: string) => {
    const nascFormatted = p.nascimento
      ? (() => {
          const d = new Date(p.nascimento!);
          return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
        })()
      : "";
    const sexoLabel = p.sexo === "M" ? "Masculino" : p.sexo === "F" ? "Feminino" : p.sexo || "";
    setValue("cpf", formatCPF(cpfRaw));
    setValue("nomeCompleto", p.razao_social || "");
    setValue("dataNascimento", nascFormatted);
    setValue("sexo", sexoLabel);
    const ecRaw = (p.estado_civil || "").trim();
    setValue("estadoCivil", estadoCivilMap[ecRaw] || ecRaw);
    setValue("rgRepresentante", p.rg || "");
    setValue("orgaoEmissor", p.orgaoemissor || "");
    setValue("profissao", p.profissao || "");
    setValue("telefone", p.telefone1 || "");
    setValue("telefone2", p.telefone2 || "");
    setValue("email", p.email1 || "");
    setValue("cep", p.cep ? formatCEP(p.cep) : "");
    setValue("logradouro", p.logradouro || "");
    setValue("numero", p.numero || "");
    setValue("complemento", p.complemento || "");
    setValue("bairro", p.bairro || "");
    setValue("cidade", p.cidade || "");
    const ufRaw = (p.estado || "").trim();
    setValue("estado", estadoMap[ufRaw] || ufRaw);
    setCpfCheckResult({ existe: true, pessoa: p });
    setPromarcosCodigo(p.codigo);
    setPromarkosPreloaded(true);
  };

  useEffect(() => {
    if (!cpfFromUrl || isEditing) return;
    if (!navigator.onLine) {
      setValue("cpf", formatCPF(cpfFromUrl));
      return;
    }
    const load = async () => {
      setCpfChecking(true);
      try {
        const result = await buscarPorCpf(cpfFromUrl);
        if (result.existe && result.pessoas.length > 0) {
          fillFormFromPromarcos(result.pessoas[0], cpfFromUrl);
        } else {
          setValue("cpf", formatCPF(cpfFromUrl));
          setCpfCheckResult({ existe: false });
        }
      } catch {
        setCpfCheckResult(null);
      } finally {
        setCpfChecking(false);
      }
    };
    load();
  }, [cpfFromUrl, isEditing]);

  // --- CPF watch → check Promarcos and auto-fill ---
  const cpfValue = watch("cpf");
  const cpfRequestIdRef = useRef(0);
  useEffect(() => {
    if (cpfTimerRef.current) clearTimeout(cpfTimerRef.current);
    if (isEditing || promarkosPreloaded) return;
    const cpfNums = cpfValue?.replace(/\D/g, "") || "";
    if (cpfNums.length !== 11) {
      setCpfCheckResult(null);
      return;
    }
    if (!navigator.onLine) return;
    const requestId = ++cpfRequestIdRef.current;
    cpfTimerRef.current = setTimeout(async () => {
      setCpfChecking(true);
      try {
        const result = await buscarPorCpf(cpfNums);
        if (requestId !== cpfRequestIdRef.current) return;
        const currentCpf = getValues("cpf")?.replace(/\D/g, "") || "";
        if (currentCpf !== cpfNums) return;
        if (result.existe && result.pessoas.length > 0) {
          fillFormFromPromarcos(result.pessoas[0], cpfNums);
          registrarAuditoria({ tipo_acao: "pesquisa_cpf", cpf_consultado: cpfNums, havia_cadastro: "sim", termo_buscado: result.pessoas[0]?.razao_social });
        } else {
          setCpfCheckResult({ existe: false });
          setPromarcosCodigo(null);
          registrarAuditoria({ tipo_acao: "pesquisa_cpf", cpf_consultado: cpfNums, havia_cadastro: "nao" });
        }
      } catch {
        if (requestId === cpfRequestIdRef.current) {
          setCpfCheckResult(null);
        }
      } finally {
        if (requestId === cpfRequestIdRef.current) {
          setCpfChecking(false);
        }
      }
    }, 600);
    return () => {
      if (cpfTimerRef.current) clearTimeout(cpfTimerRef.current);
    };
  }, [cpfValue, isEditing, promarkosPreloaded]);

  // --- Masks & External API ---
  const cepValue = watch("cep");
  useEffect(() => {
    const rawCep = cepValue?.replace(/\D/g, "") || "";
    if (rawCep.length === 8) {
      if (!navigator.onLine) {
        toast({ title: "Sem conexão", description: "O preenchimento automático do CEP requer internet." });
        return;
      }
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
        })
        .catch(() => {});
    }
  }, [cepValue, setValue, toast]);

  // --- Handlers ---
  const onSubmit = async (data: ClientFormData) => {
    if (!isOnline && !isEditing) {
      try {
        const dataWithPromarcos = { ...data, promarcosCodigo: promarcosCodigo ?? undefined };
        await addPendingSubmission(dataWithPromarcos as Record<string, unknown>);
        await refreshQueue();
        toast({ title: "Salvo offline", description: "Os dados serão enviados automaticamente quando a conexão retornar." });
        reset();
        return;
      } catch {
        toast({ title: "Erro", description: "Não foi possível salvar localmente.", variant: "destructive" });
        return;
      }
    }

    if (!isOnline && isEditing) {
      toast({ title: "Sem conexão", description: "A edição de clientes requer conexão com a internet.", variant: "destructive" });
      return;
    }

    try {
      let nascimentoISO: string | null = null;
      if (data.dataNascimento) {
        const parts = data.dataNascimento.split("/");
        if (parts.length === 3) {
          nascimentoISO = `${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`;
        } else if (data.dataNascimento.includes("-")) {
          nascimentoISO = data.dataNascimento;
        }
      }

      const promarkosPayload = {
        Pessoa: {
          razao_social: data.nomeCompleto,
          cpf: data.cpf,
          rg: data.rgRepresentante || "",
          orgaoemissor: data.orgaoEmissor || "",
          estado_civil: data.estadoCivil || "",
          nascimento: nascimentoISO,
          sexo: data.sexo === "Masculino" ? "M" : data.sexo === "Feminino" ? "F" : data.sexo || "",
          cep: data.cep?.replace(/\D/g, "") || "",
          bairro: data.bairro || "",
          logradouro: data.logradouro || "",
          numero: data.numero || "",
          complemento: data.complemento || "",
          estadoId: null as number | null,
          cidadeId: null as number | null,
          email1: data.email || "",
          telefone1: data.telefone || "",
          telefone2: data.telefone2 || "",
          profissao: data.profissao || "",
          observacoes: data.observacao || "",
          ativo: true,
          codempresa: empresas.find(e => e.nome === data.escritorio)?.id ?? 1,
        },
        Processos: [],
      };

      if (cpfCheckResult?.existe && cpfCheckResult.pessoa?.estadoId) {
        promarkosPayload.Pessoa.estadoId = cpfCheckResult.pessoa.estadoId;
        promarkosPayload.Pessoa.cidadeId = cpfCheckResult.pessoa.cidadeId;
      }

      const promarcosResult = await salvarPessoa(promarkosPayload);
      if (!promarcosResult.sucesso && promarcosResult.duplicado) {
        toast({ title: "CPF já cadastrado no Promarcos", description: `Já existe: ${cpfCheckResult?.pessoa?.razao_social || ""}`, variant: "destructive" });
      }

      const dataWithPromarcos = { ...data, promarcosCodigo: promarcosCodigo ?? undefined };
      if (isEditing) {
        const oldData = clientData as Record<string, unknown>;
        const changedFields: Record<string, { old: unknown; new: unknown }> = {};
        for (const key of Object.keys(data)) {
          const oldVal = oldData?.[key];
          const newVal = (data as Record<string, unknown>)[key];
          if (oldVal !== newVal && String(oldVal || "") !== String(newVal || "")) {
            changedFields[key] = { old: oldVal, new: newVal };
          }
        }
        await updateClient.mutateAsync({ id: clientId, data: dataWithPromarcos });
        registrarAuditoria({
          tipo_acao: "alteracao",
          cpf_consultado: data.cpf,
          campos_alterados: Object.keys(changedFields).length > 0 ? changedFields : undefined,
        });
        toast({ title: "Sucesso", description: "Cliente atualizado com sucesso!" });
      } else {
        const newClient = await createClient.mutateAsync({ data: dataWithPromarcos });
        registrarAuditoria({
          tipo_acao: "cadastro_novo",
          cpf_consultado: data.cpf,
          havia_cadastro: "nao",
        });
        toast({ title: "Sucesso", description: promarcosResult.sucesso ? "Cliente salvo no Promarcos e no sistema!" : "Cliente salvo no sistema (Promarcos: verifique)." });
        setLocation(`/cliente/${newClient.id}`);
      }
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível salvar o cliente.", variant: "destructive" });
    }
  };

  const openFolder = () => {
    const path = watch("pastaPath");
    if (!path) {
      toast({ title: "Atenção", description: "Caminho da pasta não definido.", variant: "destructive" });
      return;
    }
    try {
      window.open(`file:///${path.replace(/\\/g, '/')}`);
    } catch {
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

  // --- ZapSign Document State ---
  const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);
  const [zapsignDocs, setZapsignDocs] = useState<any[]>([]);
  const [loadingZapDocs, setLoadingZapDocs] = useState(false);
  const [signingAll, setSigningAll] = useState(false);

  const getClienteDocData = () => {
    const vals = getValues();
    return {
      nomeCompleto: vals.nomeCompleto,
      cpf: vals.cpf,
      rg: vals.rgRepresentante || "",
      orgaoEmissor: vals.orgaoEmissor || "",
      estadoCivil: vals.estadoCivil,
      profissao: vals.profissao,
      dataNascimento: vals.dataNascimento,
      sexo: vals.sexo,
      logradouro: vals.logradouro,
      numero: vals.numero,
      complemento: vals.complemento || "",
      bairro: vals.bairro,
      cidade: vals.cidade,
      estado: vals.estado,
      cep: vals.cep,
      telefone: vals.telefone,
      email: vals.email || "",
      escritorio: vals.escritorio,
    };
  };

  const fetchZapsignDocs = async (cpf: string) => {
    if (!cpf) return;
    setLoadingZapDocs(true);
    try {
      const res = await fetch(`/api/zapsign/documentos/${cpf.replace(/\D/g, "")}`);
      if (res.ok) {
        const data = await res.json();
        setZapsignDocs(data);
      }
    } catch {} finally {
      setLoadingZapDocs(false);
    }
  };

  useEffect(() => {
    const cpf = getValues("cpf");
    if (cpf && (promarkosPreloaded || isEditing)) {
      fetchZapsignDocs(cpf);
    }
  }, [promarkosPreloaded, isEditing]);

  const generateDoc = async (name: string) => {
    if (!isOnline) {
      toast({ title: "Requer internet", description: "A geração de documentos e assinatura digital requer conexão com a internet.", variant: "destructive" });
      return;
    }
    const clienteData = getClienteDocData();
    if (!clienteData.nomeCompleto || !clienteData.cpf) {
      toast({ title: "Erro", description: "Preencha os dados do cliente antes de gerar documentos.", variant: "destructive" });
      return;
    }

    if (name === "Gerar Todos") {
      setGeneratingDoc("Gerar Todos");
      try {
        const res = await fetch("/api/zapsign/gerar-todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cliente: clienteData, clienteId: clientId ? parseInt(clientId) : undefined }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ mensagem: "Erro" }));
          toast({ title: "Erro", description: (err as any).mensagem || "Erro ao gerar documentos", variant: "destructive" });
        } else {
          const data = await res.json();
          if (data.parcial) {
            toast({ title: "Atenção", description: data.mensagem || "Alguns documentos não puderam ser gerados." });
          } else {
            toast({ title: "Sucesso", description: "Todos os documentos foram gerados e vinculados para assinatura única." });
          }
          await fetchZapsignDocs(clienteData.cpf);
        }
      } catch {
        toast({ title: "Erro", description: "Erro ao conectar com o servidor", variant: "destructive" });
      }
      setGeneratingDoc(null);
      return;
    }

    setGeneratingDoc(name);
    try {
      const res = await fetch("/api/zapsign/gerar-e-enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: name, cliente: clienteData, clienteId: clientId ? parseInt(clientId) : undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ mensagem: "Erro" }));
        toast({ title: "Erro", description: (err as any).mensagem || "Erro ao gerar documento", variant: "destructive" });
      } else {
        toast({ title: "Documento Gerado", description: `${name} enviado para assinatura digital.` });
        await fetchZapsignDocs(clienteData.cpf);
      }
    } catch {
      toast({ title: "Erro", description: "Erro ao conectar com o servidor", variant: "destructive" });
    }
    setGeneratingDoc(null);
  };

  const handleAssinar = async (doc: any) => {
    if (!isOnline) {
      toast({ title: "Requer internet", description: "A assinatura digital requer conexão com a internet.", variant: "destructive" });
      return;
    }
    if (doc.urlAssinatura) {
      window.open(doc.urlAssinatura, "_blank");
      return;
    }
    try {
      const res = await fetch(`/api/zapsign/assinar/${doc.id}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.open(data.url, "_blank");
        }
      } else {
        toast({ title: "Erro", description: "Não foi possível obter link de assinatura", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Erro ao conectar", variant: "destructive" });
    }
  };

  const handleAssinarTodos = async () => {
    const pendentes = zapsignDocs.filter(d => d.statusAssinatura === "pendente");
    if (pendentes.length === 0) return;
    setSigningAll(true);
    const loteUrls = new Set<string>();
    for (const doc of pendentes) {
      const url = doc.urlAssinatura;
      if (url && !loteUrls.has(url)) {
        loteUrls.add(url);
        window.open(url, "_blank");
      } else if (!url) {
        await handleAssinar(doc);
      }
    }
    setSigningAll(false);
  };

  const handleDeleteZapDoc = async (id: number) => {
    try {
      const res = await fetch(`/api/zapsign/documento/${id}`, { method: "DELETE" });
      if (res.ok) {
        setZapsignDocs(prev => prev.filter(d => d.id !== id));
        toast({ title: "Removido", description: "Documento removido." });
      }
    } catch {
      toast({ title: "Erro", description: "Erro ao remover", variant: "destructive" });
    }
  };

  const handleDownloadOriginal = async (doc: any) => {
    if (doc.urlPdfOriginal) {
      window.open(doc.urlPdfOriginal, "_blank");
    } else {
      const clienteData = getClienteDocData();
      const res = await fetch("/api/documentos/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: doc.tipoDocumento, cliente: clienteData }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.nomeArquivo;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  const handleDownloadSigned = (doc: any) => {
    if (doc.urlPdfAssinado || doc.signedFile) {
      window.open(doc.urlPdfAssinado || doc.signedFile, "_blank");
    }
  };

  const handleRefreshStatus = async () => {
    const cpf = getValues("cpf");
    if (!cpf) return;
    setLoadingZapDocs(true);
    try {
      await fetch(`/api/zapsign/atualizar-status/${cpf.replace(/\D/g, "")}`, { method: "POST" });
      await fetchZapsignDocs(cpf);
    } catch {} finally {
      setLoadingZapDocs(false);
    }
  };

  const [isProcessoModalOpen, setProcessoModalOpen] = useState(false);
  const [editingProcesso, setEditingProcesso] = useState<any>(null);
  const emptyProcesso = { numeroPasta: "", numeroProcesso: "", dataEntrada: "", fluxo: "Analise", estagio: "Triagem", urgencia: false, observacoes: "", fatoGerador: "", matricula: "", dataFatoGerador: "", escritorioProcesso: "Mendes Advocacia - Araguaína - A", beneficio: "AÇÃO CÍVEL", tipoBeneficio: "TODAS", status: "Ativo", cadastradoPor: "", localPromarkosEscritorioid: 0, localPromarkosBeneficioidCat: 0, localPromarkosBeneficioid: 0, sincronizarPromarcos: false };
  const [novoProcesso, setNovoProcesso] = useState<any>(emptyProcesso);

  const openProcessoModal = async (processo?: any) => {
    if (processo) {
      setEditingProcesso(processo);
      setNovoProcesso({ ...emptyProcesso, ...processo, localPromarkosEscritorioid: 0, localPromarkosBeneficioidCat: 0, localPromarkosBeneficioid: 0, sincronizarPromarcos: false });
    } else {
      setEditingProcesso(null);
      const defaultEscritorio = empresas[0]?.id ?? 0;
      setNovoProcesso({ ...emptyProcesso, localPromarkosEscritorioid: defaultEscritorio });
    }
    if (beneficios.length === 0) {
      const bens = await buscarBeneficios();
      setBeneficios(bens);
    }
    setBeneficioTipos([]);
    setProcessoModalOpen(true);
  };

  const handleCreateProcesso = async () => {
    try {
      if (editingProcesso) {
        await updateProcesso.mutateAsync({ id: editingProcesso.id, data: novoProcesso });
        toast({ title: "Sucesso", description: "Processo atualizado!" });
        setProcessoModalOpen(false);
        queryClient.invalidateQueries({ queryKey: [`/api/clientes/${clientId}/processos`] });
      } else {
        const localResult = await createProcesso.mutateAsync({ id: clientId, data: novoProcesso });
        const localId = (localResult as any)?.id;
        const podePromarcos = novoProcesso.sincronizarPromarcos && promarcosCodigo && novoProcesso.localPromarkosEscritorioid > 0 && novoProcesso.localPromarkosBeneficioid > 0;
        if (podePromarcos) {
          try {
            const pmResult = await criarProcessoPromarcos({
              escritorioid: novoProcesso.localPromarkosEscritorioid,
              beneficioid: novoProcesso.localPromarkosBeneficioid,
              pessoaid: promarcosCodigo!,
              dataentrada: novoProcesso.dataEntrada || new Date().toISOString().split("T")[0],
              urgencia: !!novoProcesso.urgencia,
              modo: "novo",
              numeroprocesso: novoProcesso.numeroProcesso || undefined,
              fluxo: novoProcesso.fluxo || undefined,
              estagio: novoProcesso.estagio || undefined,
              observacoes: novoProcesso.observacoes || undefined,
              fatogerador: novoProcesso.fatoGerador || undefined,
              numeropasta: novoProcesso.numeroPasta || undefined,
            });
            if (pmResult.sucesso && pmResult.id && localId) {
              await updateProcesso.mutateAsync({ id: localId, data: { promarkosProcessoId: pmResult.id } as any });
              fetchPromarkosProcessos(promarcosCodigo!);
              toast({ title: "Processo criado!", description: `Salvo localmente e no Promarcos (pasta #${pmResult.id}).` });
            } else if (!pmResult.sucesso) {
              toast({ title: "Processo salvo localmente", description: `Mas falhou no Promarcos: ${pmResult.mensagem || "erro desconhecido"}`, variant: "destructive" });
            } else {
              toast({ title: "Processo criado!", description: "Salvo localmente e no Promarcos." });
            }
          } catch {
            toast({ title: "Processo salvo localmente", description: "Mas houve uma falha ao enviar para o Promarcos.", variant: "destructive" });
          }
        } else {
          toast({ title: "Sucesso", description: "Processo adicionado!" });
        }
        registrarAuditoria({
          tipo_acao: "abertura_processo",
          cpf_consultado: watch("cpf"),
          termo_buscado: novoProcesso.numeroProcesso
            ? `Processo ${novoProcesso.numeroProcesso}`
            : `Novo processo`,
        });
        setProcessoModalOpen(false);
        queryClient.invalidateQueries({ queryKey: [`/api/clientes/${clientId}/processos`] });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao salvar processo", variant: "destructive" });
    }
  };

  const openPromarkosProcessoModal = async (processoToEdit?: PromarkosProcesso) => {
    const escritorioDefault = empresas[0]?.id ?? 0;
    const bens = await buscarBeneficios();
    setBeneficios(bens);
    setBeneficioTipos([]);
    if (processoToEdit) {
      setEditingPromarkosProcesso(processoToEdit);
      const matchedBeneficio = bens.find(b => processoToEdit.beneficio.toLowerCase().includes(b.descricao.toLowerCase()));
      const beneficioCatId = matchedBeneficio?.id ?? 0;
      let tipoId = 0;
      if (beneficioCatId > 0) {
        const tipos = await buscarBeneficioTipos(beneficioCatId);
        setBeneficioTipos(tipos);
        const categoryName = matchedBeneficio?.descricao ?? "";
        const tipoDescPart = (processoToEdit.TipoBeneficio || processoToEdit.beneficio).replace(categoryName, "").trim();
        const matchedTipo = tipos.find(t => t.descricao.toLowerCase() === tipoDescPart.toLowerCase())
          ?? tipos.find(t => (processoToEdit.TipoBeneficio || "").toLowerCase().includes(t.descricao.toLowerCase()));
        tipoId = matchedTipo?.id ?? 0;
      }
      setNovoPromarkosProcesso({
        ...emptyPromarkosProcesso,
        escritorioid: processoToEdit.escritorioid,
        beneficioid_categoria: beneficioCatId,
        beneficioid: tipoId,
        dataentrada: processoToEdit.dataentrada ? processoToEdit.dataentrada.split("T")[0] : new Date().toISOString().split("T")[0],
        urgencia: processoToEdit.urgencia,
        modo: "existente",
        numeroprocesso: processoToEdit.numeroprocesso || "",
        numeropasta: processoToEdit.numeropasta ? String(processoToEdit.numeropasta) : "",
        fatogerador: processoToEdit.nomefatogerador || "",
      });
    } else {
      setEditingPromarkosProcesso(null);
      setNovoPromarkosProcesso({ ...emptyPromarkosProcesso, escritorioid: escritorioDefault });
    }
    setShowObservacoes(false);
    setPromarkosProcessoModalOpen(true);
  };

  const handleBeneficioCategoriaChange = async (beneficioid: number) => {
    setNovoPromarkosProcesso(p => ({ ...p, beneficioid_categoria: beneficioid, beneficioid: 0 }));
    setBeneficioTipos([]);
    if (beneficioid > 0) {
      const tipos = await buscarBeneficioTipos(beneficioid);
      setBeneficioTipos(tipos);
    }
  };

  useEffect(() => {
    if (editingPromarkosProcesso) {
      setLoadingComissoes(true);
      setProcessoIndicadores([]);
      setProcessoSocios([]);
      setNovoIndTermo(""); setNovoIndSelecionado(null); setNovoIndPercentual(0); setNovoIndResultados([]);
      setNovoSocioTermo(""); setNovoSocioSelecionado(null); setNovoSocioPercentual(0); setNovoSocioResultados([]);
      Promise.all([
        buscarIndicadoresProcesso(editingPromarkosProcesso.id),
        buscarSociosProcesso(editingPromarkosProcesso.id),
      ]).then(([inds, socios]) => {
        setProcessoIndicadores(inds);
        setProcessoSocios(socios);
        setLoadingComissoes(false);
      });
    } else {
      setProcessoIndicadores([]);
      setProcessoSocios([]);
    }
  }, [editingPromarkosProcesso?.id]);

  useEffect(() => {
    if (!novoIndTermo || novoIndTermo.length < 2) { setNovoIndResultados([]); return; }
    const t = setTimeout(async () => {
      const results = await buscarSocio(novoIndTermo);
      setNovoIndResultados(results.slice(0, 8));
    }, 300);
    return () => clearTimeout(t);
  }, [novoIndTermo]);

  useEffect(() => {
    if (!novoSocioTermo || novoSocioTermo.length < 2) { setNovoSocioResultados([]); return; }
    const t = setTimeout(async () => {
      const results = await buscarSocio(novoSocioTermo);
      setNovoSocioResultados(results.slice(0, 8));
    }, 300);
    return () => clearTimeout(t);
  }, [novoSocioTermo]);

  useEffect(() => {
    const catId = novoProcesso.localPromarkosBeneficioidCat;
    if (!catId || catId === 0 || !isProcessoModalOpen) return;
    setBeneficioTipos([]);
    setNovoProcesso((p: any) => ({ ...p, localPromarkosBeneficioid: 0 }));
    buscarBeneficioTipos(catId).then(setBeneficioTipos);
  }, [novoProcesso.localPromarkosBeneficioidCat, isProcessoModalOpen]);

  const handleAdicionarIndicador = async () => {
    if (!novoIndSelecionado || !editingPromarkosProcesso) return;
    setAdicionandoInd(true);
    const result = await adicionarIndicador(editingPromarkosProcesso.id, novoIndSelecionado.codigo, novoIndPercentual);
    if (result.sucesso) {
      const fresh = await buscarIndicadoresProcesso(editingPromarkosProcesso.id);
      setProcessoIndicadores(fresh);
      setNovoIndTermo(""); setNovoIndSelecionado(null); setNovoIndPercentual(0); setNovoIndResultados([]);
    } else {
      toast({ title: "Erro", description: result.mensagem || "Falha ao adicionar indicador", variant: "destructive" });
    }
    setAdicionandoInd(false);
  };

  const handleRemoverIndicador = async (id: number) => {
    await removerIndicador(id);
    setProcessoIndicadores(prev => prev.filter(i => i.id !== id));
  };

  const handleAdicionarSocio = async () => {
    if (!novoSocioSelecionado || !editingPromarkosProcesso) return;
    setAdicionandoSocio(true);
    const result = await adicionarSocio(editingPromarkosProcesso.id, novoSocioSelecionado.codigo, novoSocioPercentual);
    if (result.sucesso) {
      const fresh = await buscarSociosProcesso(editingPromarkosProcesso.id);
      setProcessoSocios(fresh);
      setNovoSocioTermo(""); setNovoSocioSelecionado(null); setNovoSocioPercentual(0); setNovoSocioResultados([]);
    } else {
      toast({ title: "Erro", description: result.mensagem || "Falha ao adicionar sócio", variant: "destructive" });
    }
    setAdicionandoSocio(false);
  };

  const handleRemoverSocio = async (id: number) => {
    await removerSocio(id);
    setProcessoSocios(prev => prev.filter(s => s.id !== id));
  };

  const handleCriarPromarkosProcesso = async () => {
    if (!promarcosCodigo) return;
    if (!novoPromarkosProcesso.beneficioid || !novoPromarkosProcesso.escritorioid) {
      toast({ title: "Atenção", description: "Selecione o benefício e o escritório.", variant: "destructive" });
      return;
    }
    try {
      const payload = {
        escritorioid: novoPromarkosProcesso.escritorioid,
        beneficioid: novoPromarkosProcesso.beneficioid,
        pessoaid: promarcosCodigo,
        dataentrada: novoPromarkosProcesso.dataentrada,
        urgencia: novoPromarkosProcesso.urgencia,
        modo: novoPromarkosProcesso.modo,
        numeroprocesso: novoPromarkosProcesso.numeroprocesso,
        fluxo: novoPromarkosProcesso.fluxo,
        estagio: novoPromarkosProcesso.estagio,
        observacoes: novoPromarkosProcesso.observacoes,
        fatogerador: novoPromarkosProcesso.fatogerador,
        numeropasta: novoPromarkosProcesso.numeropasta,
        terrapropia: novoPromarkosProcesso.terrapropia,
        incra: novoPromarkosProcesso.incra,
        vinculoemprego: novoPromarkosProcesso.vinculoemprego,
        usuariocadastro: novoPromarkosProcesso.usuariocadastro,
      } as Parameters<typeof criarProcessoPromarcos>[0];

      let result: { sucesso: boolean; mensagem?: string };
      if (editingPromarkosProcesso) {
        result = await editarProcessoPromarcos(editingPromarkosProcesso.id, payload);
        if (result.sucesso) {
          toast({ title: "Processo atualizado!", description: "As alterações foram salvas no Promarcos." });
          setPromarkosProcessoModalOpen(false);
          setEditingPromarkosProcesso(null);
          fetchPromarkosProcessos(promarcosCodigo);
        } else {
          toast({ title: "Erro", description: result.mensagem || "Falha ao atualizar processo.", variant: "destructive" });
        }
      } else {
        result = await criarProcessoPromarcos(payload);
        if (result.sucesso) {
          registrarAuditoria({
            tipo_acao: "abertura_processo",
            cpf_consultado: watch("cpf"),
            termo_buscado: novoPromarkosProcesso.numeroprocesso
              ? `Processo ${novoPromarkosProcesso.numeroprocesso}`
              : `Nova pasta Promarcos`,
          });
          toast({ title: "Processo criado!", description: "Nova pasta aberta no Promarcos com sucesso." });
          setPromarkosProcessoModalOpen(false);
          fetchPromarkosProcessos(promarcosCodigo);
        } else {
          toast({ title: "Erro", description: result.mensagem || "Falha ao criar processo no Promarcos.", variant: "destructive" });
        }
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao salvar processo no Promarcos.", variant: "destructive" });
    }
  };

  const handleGerarFolhaRosto = async (processo: PromarkosProcesso) => {
    if (!promarcosCodigo) return;
    setGerandoFolha(processo.id);
    try {
      const result = await gerarFolhaRosto(promarcosCodigo);
      if (!result.sucesso || !result.blob) {
        toast({ title: "Erro", description: result.mensagem || "Falha ao gerar folha de rosto.", variant: "destructive" });
        return;
      }
      let pdfFileName = result.fileName || `folha_rosto_${promarcosCodigo}.pdf`;
      if (!pdfFileName.toLowerCase().endsWith(".pdf")) {
        pdfFileName = pdfFileName + ".pdf";
      }
      const pdfBlob = new Blob([result.blob], { type: "application/pdf" });
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pdfFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const upload = await uploadArquivoPromarcos(promarcosCodigo, pdfBlob, pdfFileName);
      if (upload.sucesso) {
        toast({ title: "Folha de Rosto gerada!", description: "Documento gerado e enviado ao Promarcos com sucesso." });
      } else {
        toast({ title: "Gerada localmente", description: "PDF baixado. Falha ao enviar ao Promarcos: " + (upload.mensagem || "erro desconhecido"), variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao gerar folha de rosto.", variant: "destructive" });
    } finally {
      setGerandoFolha(null);
    }
  };

  const TIPO_TO_SLUG: Record<string, string> = {
    "Folha de rosto": "folha-rosto",
    "Procuração": "procuracao",
    "Docs Pessoais": "docs-pessoais",
    "Residência": "residencia",
    "Fato gerador": "fato-gerador",
    "Cert. Casamento": "cert-casamento",
    "Cert. Óbito": "cert-obito",
    "Provas rurais": "provas-rurais",
    "Laudo médico": "laudo-medico",
    "Outros": "outros",
  };

  const handleFileUpload = (tipo: string) => {
    if (!isOnline) {
      toast({ title: "Requer internet", description: "O upload de documentos requer conexão com a internet.", variant: "destructive" });
      return;
    }
    if (!promarcosCodigo) {
      toast({ title: "Cliente não vinculado", description: "Este cliente não possui vínculo com o Promarcos. Salve o cliente primeiro.", variant: "destructive" });
      return;
    }
    const tipoSlug = TIPO_TO_SLUG[tipo] || "outros";
    setScannerModal({ tipo, tipoSlug });
  };

  const handleUploadArquivoManual = async (tipo: string) => {
    if (!promarcosCodigo) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0) return;
      toast({ title: "Enviando...", description: `Enviando ${files.length} arquivo(s) para o Promarcos...` });
      let successCount = 0;
      let failCount = 0;
      const nomeCliente = clientData?.nomeCompleto || "";
      for (const file of files) {
        const result = await uploadArquivoPromarcos(
          promarcosCodigo, file, file.name, tipo,
          `${tipo}${nomeCliente ? ` - ${nomeCliente}` : ""}`,
        );
        if (result.sucesso) successCount++; else failCount++;
      }
      setScannerModal(null);
      if (failCount === 0) {
        registrarAuditoria({
          tipo_acao: "upload_documento",
          cpf_consultado: watch("cpf"),
          termo_buscado: `${tipo} - ${successCount} arquivo(s)`,
        });
        toast({ title: "Upload concluído!", description: `${successCount} arquivo(s) de "${tipo}" enviado(s) ao Promarcos com sucesso.` });
      } else if (successCount > 0) {
        toast({ title: "Parcialmente concluído", description: `${successCount} enviado(s), ${failCount} falhou.`, variant: "destructive" });
      } else {
        toast({ title: "Falha no upload", description: "Não foi possível enviar os arquivos. Tente novamente.", variant: "destructive" });
      }
    };
    input.click();
  };

  const addFilesFromInput = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    const newPreviews = newFiles.map(f => URL.createObjectURL(f));
    setCapturedFiles(prev => [...prev, ...newFiles]);
    setCapturedPreviews(prev => [...prev, ...newPreviews]);
    setUploadDone(false);
  };

  const openCameraInput = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => addFilesFromInput((e.target as HTMLInputElement).files);
    input.click();
  };

  const openGalleryInput = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.multiple = true;
    input.onchange = (e) => addFilesFromInput((e.target as HTMLInputElement).files);
    input.click();
  };

  const handleUploadCaptured = async () => {
    if (!promarcosCodigo || capturedFiles.length === 0 || !scannerModal) return;
    setUploadingFiles(true);
    const nomeCliente = clientData?.nomeCompleto || "";
    let successCount = 0;
    let failCount = 0;
    for (const file of capturedFiles) {
      const result = await uploadArquivoPromarcos(
        promarcosCodigo, file, file.name, scannerModal.tipo,
        `${scannerModal.tipo}${nomeCliente ? ` - ${nomeCliente}` : ""}`,
      );
      if (result.sucesso) successCount++; else failCount++;
    }
    setUploadingFiles(false);
    if (failCount === 0) {
      setUploadDone(true);
    } else {
      toast({ title: failCount === capturedFiles.length ? "Falha no envio" : "Parcialmente enviado", description: `${successCount} enviado(s), ${failCount} com falha.`, variant: "destructive" });
    }
  };

  const handleDocScannerUpload = async (pages: Array<{ id: string; dataUrl: string; blob: Blob; fileName: string }>) => {
    if (!promarcosCodigo || !scannerModal) throw new Error("Cliente não vinculado ao Promarcos");
    const nomeCliente = clientData?.nomeCompleto || "";
    let successCount = 0;
    let failCount = 0;
    for (const page of pages) {
      const file = new File([page.blob], page.fileName, { type: "image/jpeg" });
      const result = await uploadArquivoPromarcos(
        promarcosCodigo, file, page.fileName, scannerModal.tipo,
        `${scannerModal.tipo}${nomeCliente ? ` - ${nomeCliente}` : ""}`,
      );
      if (result.sucesso) successCount++; else failCount++;
    }
    if (failCount > 0) {
      toast({ title: failCount === pages.length ? "Falha no envio" : "Parcialmente enviado", description: `${successCount} enviado(s), ${failCount} com falha.`, variant: "destructive" });
      if (failCount === pages.length) throw new Error("Falha ao enviar todas as páginas");
    }
  };

  if (isEditing && isLoadingClient) {
    return <Layout><div className="flex justify-center p-20"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div></Layout>;
  }

  const formCtx = { register, setValue, errors };

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
              {!isEditing && promarkosPreloaded && cpfCheckResult?.pessoa && (
                <p className="text-muted-foreground font-medium">{cpfCheckResult.pessoa.razao_social}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Link
              href="/novo"
              className="hidden md:flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold border-2 border-primary/30 text-primary hover:bg-primary/5 transition-all duration-200"
            >
              <FilePlus2 className="w-5 h-5" />
              Novo
            </Link>
            <button 
              onClick={handleSubmit(onSubmit)}
              disabled={createClient.isPending || updateClient.isPending}
              className="hidden md:flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              <Save className="w-5 h-5" />
              Salvar Cliente
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex space-x-1 bg-muted/50 p-1.5 rounded-2xl mb-8 overflow-x-auto">
          {[
            { id: "cadastro", label: "Dados Cadastrais" },
            { id: "processos", label: "Processos", disabled: !isEditing && !promarkosPreloaded },
            { id: "documentos", label: "Docs e Anexos", disabled: !isEditing && !promarkosPreloaded },
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
                <div className="max-w-md space-y-1.5">
                  <label className="text-sm font-semibold text-foreground/80">Escritório Responsável *</label>
                  <select
                    {...register("escritorio")}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200",
                      errors.escritorio && "border-destructive"
                    )}
                  >
                    <option value="">Selecione o escritório...</option>
                    {empresas.map(e => (
                      <option key={e.id} value={e.nome}>{e.nome}</option>
                    ))}
                  </select>
                  {errors.escritorio && <span className="text-xs text-destructive font-medium">{errors.escritorio.message}</span>}
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

                {!isEditing && cpfChecking && (
                  <div className="mb-6 p-3 rounded-xl bg-blue-50 border-2 border-blue-100 flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    <p className="text-blue-600 text-sm">Verificando CPF no Promarcos...</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                  <FormInput form={formCtx} label="CPF *" name="cpf" maskFn={promarkosPreloaded || isEditing ? undefined : formatCPF} placeholder="000.000.000-00" readOnly={promarkosPreloaded || isEditing} />
                  <div className="lg:col-span-2">
                    <FormInput form={formCtx} label="Nome Completo *" name="nomeCompleto" placeholder="Nome do cliente" />
                  </div>
                  <FormInput form={formCtx} label="Data de Nascimento *" name="dataNascimento" maskFn={formatDate} placeholder="DD/MM/AAAA" type="text" inputMode="numeric" />
                  
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-foreground/80">Sexo *</label>
                    <select {...register("sexo")} className={cn("w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10", errors.sexo && "border-destructive")}>
                      <option value="">Selecione...</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Outro">Outro</option>
                    </select>
                    {errors.sexo && <span className="text-xs text-destructive font-medium">Obrigatório</span>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-foreground/80">Estado Civil *</label>
                    <select {...register("estadoCivil")} className={cn("w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10", errors.estadoCivil && "border-destructive")}>
                      <option value="">Selecione...</option>
                      <option value="Solteiro">Solteiro(a)</option>
                      <option value="Casado">Casado(a)</option>
                      <option value="Divorciado">Divorciado(a)</option>
                      <option value="Viúvo">Viúvo(a)</option>
                      <option value="União Estável">União Estável</option>
                    </select>
                    {errors.estadoCivil && <span className="text-xs text-destructive font-medium">Obrigatório</span>}
                  </div>

                  <FormInput form={formCtx} label="RG/Representante" name="rgRepresentante" />
                  <FormInput form={formCtx} label="Órgão Emissor" name="orgaoEmissor" />
                  <div className="lg:col-span-2">
                    <FormInput form={formCtx} label="Profissão *" name="profissao" />
                  </div>
                </div>
              </div>

              {/* Contato */}
              <div className="bg-card p-6 md:p-8 rounded-2xl shadow-sm border border-border/50">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                  <Phone className="w-5 h-5 text-primary" /> Contato
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <FormInput form={formCtx} label="Telefone / Celular *" name="telefone" maskFn={formatPhone} placeholder="(00) 00000-0000" />
                  <FormInput form={formCtx} label="2º Telefone" name="telefone2" maskFn={formatPhone} placeholder="(00) 00000-0000" optional />
                  <FormInput form={formCtx} label="E-mail" name="email" type="email" placeholder="cliente@email.com" optional />
                </div>
              </div>

              {/* Endereço */}
              <div className="bg-card p-6 md:p-8 rounded-2xl shadow-sm border border-border/50">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                  <MapPin className="w-5 h-5 text-primary" /> Endereço
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <FormInput form={formCtx} label="CEP *" name="cep" maskFn={formatCEP} placeholder="00000-000" />
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-foreground/80">Estado (UF) *</label>
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
                    <FormInput form={formCtx} label="Cidade *" name="cidade" />
                  </div>
                  
                  <div className="md:col-span-2">
                    <FormInput form={formCtx} label="Logradouro *" name="logradouro" placeholder="Rua, Avenida..." />
                  </div>
                  <FormInput form={formCtx} label="Número *" name="numero" />
                  <FormInput form={formCtx} label="Complemento" name="complemento" optional />
                  
                  <div className="md:col-span-2">
                    <FormInput form={formCtx} label="Bairro *" name="bairro" />
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

          {activeTab === "processos" && (isEditing || promarkosPreloaded) && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

              {/* Promarcos Processes Section */}
              <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-border/50 bg-primary/5">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-primary" /> Pastas no Promarcos
                  </h2>
                  <div className="flex gap-2">
                    {promarcosCodigo && (
                      <button
                        type="button"
                        disabled={!isOnline}
                        onClick={() => fetchPromarkosProcessos(promarcosCodigo)}
                        title={!isOnline ? "Requer internet" : undefined}
                        className="px-3 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                      </button>
                    )}
                    {promarcosCodigo && (
                      <button
                        type="button"
                        disabled={!isOnline}
                        onClick={() => openPromarkosProcessoModal()}
                        title={!isOnline ? "Requer internet" : undefined}
                        className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-lg shadow-primary/20 text-sm disabled:opacity-50"
                      >
                        + Novo Processo
                      </button>
                    )}
                  </div>
                </div>

                {!promarcosCodigo ? (
                  <div className="p-8 text-center">
                    <Briefcase className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">CPF não vinculado ao Promarcos. Salve o cliente primeiro para sincronizar.</p>
                  </div>
                ) : loadingPromarkosProcessos ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  </div>
                ) : promarkosProcessos.length === 0 ? (
                  <div className="p-8 text-center">
                    <Briefcase className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground font-medium">Nenhum processo encontrado no Promarcos para este cliente.</p>
                    <button type="button" disabled={!isOnline} onClick={() => openPromarkosProcessoModal()} title={!isOnline ? "Requer internet" : undefined} className="mt-4 px-5 py-2 bg-primary/10 text-primary font-semibold rounded-xl hover:bg-primary/20 transition-colors text-sm disabled:opacity-50">
                      + Novo Processo no Promarcos
                    </button>
                  </div>
                ) : (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {promarkosProcessos.map(p => {
                      const areaStatus = p.AreaAtual && p.StatusAtual ? `${p.AreaAtual}:${p.StatusAtual}` : p.StatusAtual || p.AreaAtual || "";
                      const isJud = p.AreaAtual?.toUpperCase().includes("JUD");
                      const dataEntradaFmt = p.dataentrada ? new Date(p.dataentrada).toLocaleDateString("pt-BR") : "—";
                      const dataFatoFmt = p.datafatogerador ? new Date(p.datafatogerador).toLocaleDateString("pt-BR") : "Não informada";
                      const cadastradoEmFmt = p.CreatedAt ? new Date(p.CreatedAt).toLocaleDateString("pt-BR") : "—";
                      return (
                        <div key={p.id} className="bg-background border border-border rounded-xl overflow-hidden flex flex-col shadow-sm">
                          <div className="p-4 flex-1">
                            <h3 className="font-bold text-sm uppercase tracking-wide mb-2">{p.TipoBeneficio || p.beneficio}</h3>
                            {p.numeropasta && (
                              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[#1a3557] text-white mb-3">
                                Pasta {String(p.numeropasta).padStart(6, "0")} - {p.sigla}
                              </span>
                            )}
                            <div className="space-y-1 text-sm">
                              <p><strong>Fato gerador:</strong> {p.nomefatogerador || "Sem fato gerador vinculado"}</p>
                              <p><strong>Matrícula:</strong> {p.matricula || "Sem matrícula"}</p>
                              <p><strong>Data fato gerador:</strong> {dataFatoFmt}</p>
                              <p><strong>Número processo:</strong> {p.numeroprocesso || "Sem número"}</p>
                              <p><strong>Data entrada:</strong> {dataEntradaFmt}</p>
                              <p><strong>Escritório:</strong> {p.escritorio}</p>
                              {p.usuario && <p className="text-xs text-muted-foreground pt-1">Cadastrado em {cadastradoEmFmt} por {p.usuario}</p>}
                            </div>
                          </div>
                          <div className="px-4 pb-2">
                            <button
                              type="button"
                              disabled={gerandoFolha === p.id}
                              onClick={() => handleGerarFolhaRosto(p)}
                              className="w-full py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {gerandoFolha === p.id ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</>
                              ) : (
                                <>Gerar folha de Rosto</>
                              )}
                            </button>
                          </div>
                          <div className="px-4 py-3 flex items-center justify-between border-t border-border/50">
                            {areaStatus ? (
                              <span className={cn(
                                "px-2.5 py-1 rounded-full text-xs font-bold",
                                isJud ? "bg-red-500 text-white" :
                                p.StatusAtual?.toLowerCase().includes("aguardando") ? "bg-blue-500 text-white" :
                                "bg-blue-500 text-white"
                              )}>
                                {areaStatus}
                              </span>
                            ) : <span />}
                            <div className="flex items-center gap-1">
                              {p.urgencia && <span className="text-red-500 font-bold text-xs mr-1">⚡</span>}
                              <button type="button" onClick={() => openPromarkosProcessoModal(p)} className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground" title="Editar processo">
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                              </button>
                              <button type="button" className="p-1.5 hover:bg-muted rounded-lg transition-colors text-blue-600 hover:text-blue-700">
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                              </button>
                              <button type="button" className="p-1.5 hover:bg-muted rounded-lg transition-colors text-red-500 hover:text-red-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </motion.div>
          )}

          {activeTab === "documentos" && (isEditing || promarkosPreloaded) && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              
              {/* Gerar documentos padrão */}
              <div className="bg-card p-6 md:p-8 rounded-2xl shadow-sm border border-border/50">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" /> Gerar documentos padrão
                </h2>
                <div className="flex flex-wrap gap-2">
                  {["Procuração Extra", "Contrato", "Declaração não incidência", "Declaração Hipossuficiência", "Termo de Risco", "Revogação"].map(doc => (
                    <button
                      type="button"
                      key={doc}
                      disabled={!!generatingDoc || !isOnline}
                      onClick={() => generateDoc(doc)}
                      title={!isOnline ? "Requer internet" : undefined}
                      className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                    >
                      {generatingDoc === doc ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus2 className="w-4 h-4" />}
                      {doc === "Declaração não incidência" ? "Decl. não incidência" : doc === "Declaração Hipossuficiência" ? "Decl. Hipossuficiência" : doc === "Revogação" ? "Revogação procuração" : doc}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={!!generatingDoc || !isOnline}
                    onClick={() => generateDoc("Gerar Todos")}
                    title={!isOnline ? "Requer internet" : undefined}
                    className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                  >
                    {generatingDoc === "Gerar Todos" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus2 className="w-4 h-4" />}
                    Gerar Todos
                  </button>
                </div>
              </div>

              {/* Documentos pendentes de assinatura */}
              {(() => {
                const pendentes = zapsignDocs.filter(d => d.statusAssinatura === "pendente");
                const assinados = zapsignDocs.filter(d => d.statusAssinatura === "assinado");
                return (
                  <>
                    {pendentes.length > 0 && (
                      <div className="bg-card p-6 md:p-8 rounded-2xl shadow-sm border-2 border-orange-300">
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-3">
                            <span className="text-orange-600 font-bold text-sm">{pendentes.length} documento{pendentes.length > 1 ? "s" : ""} pendente{pendentes.length > 1 ? "s" : ""} de assinatura</span>
                            <button type="button" onClick={handleRefreshStatus} disabled={loadingZapDocs || !isOnline} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title={!isOnline ? "Requer internet" : "Atualizar status"}>
                              <RefreshCw className={cn("w-4 h-4", loadingZapDocs && "animate-spin")} />
                            </button>
                          </div>
                          <button
                            type="button"
                            disabled={signingAll || !isOnline}
                            onClick={handleAssinarTodos}
                            title={!isOnline ? "Requer internet" : undefined}
                            className="px-4 py-2 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
                          >
                            {signingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                            Assinar todos
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {pendentes.map(doc => (
                            <div key={doc.id} className="border-2 border-orange-300 rounded-xl bg-orange-50 overflow-hidden">
                              <div className="p-3">
                                <p className="text-sm font-semibold text-gray-800 truncate" title={doc.nomeArquivo}>{doc.nomeArquivo}</p>
                                <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold bg-green-500 text-white">Pendente</span>
                              </div>
                              <div className="px-3 pb-3 flex items-center gap-1">
                                <button type="button" onClick={() => handleDownloadOriginal(doc)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Visualizar">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                </button>
                                <button type="button" onClick={() => handleDownloadOriginal(doc)} className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors" title="Baixar">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                </button>
                                <button type="button" disabled={!isOnline} onClick={() => handleAssinar(doc)} className="p-2 text-orange-600 hover:text-orange-700 hover:bg-orange-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold disabled:opacity-50" title={!isOnline ? "Requer internet" : "Assinar"}>
                                  <ExternalLink className="w-4 h-4" />
                                  <span>Assinar</span>
                                </button>
                                <button type="button" disabled={!isOnline} onClick={() => handleDeleteZapDoc(doc.id)} className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-auto disabled:opacity-50" title={!isOnline ? "Requer internet" : "Excluir"}>
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {assinados.length > 0 && (
                      <div className="bg-card p-6 md:p-8 rounded-2xl shadow-sm border-2 border-green-300">
                        <h3 className="text-green-700 font-bold text-sm mb-4 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          {assinados.length} documento{assinados.length > 1 ? "s" : ""} assinado{assinados.length > 1 ? "s" : ""}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {assinados.map(doc => (
                            <div key={doc.id} className="border border-green-300 rounded-xl bg-green-50 overflow-hidden">
                              <div className="p-3">
                                <p className="text-sm font-semibold text-gray-800 truncate" title={doc.nomeArquivo}>{doc.nomeArquivo}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-blue-600 text-white">Assinado</span>
                                  {doc.dataAssinatura && <span className="text-xs text-muted-foreground">{new Date(doc.dataAssinatura).toLocaleDateString("pt-BR")}</span>}
                                </div>
                              </div>
                              <div className="px-3 pb-3 flex items-center gap-1">
                                <button type="button" onClick={() => handleDownloadSigned(doc)} className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors" title="Baixar assinado">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                </button>
                                <button type="button" onClick={() => handleDownloadOriginal(doc)} className="p-2 text-gray-500 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors" title="Baixar original">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                </button>
                                <button type="button" disabled={!isOnline} onClick={() => handleDeleteZapDoc(doc.id)} className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-auto disabled:opacity-50" title={!isOnline ? "Requer internet" : "Excluir"}>
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {loadingZapDocs && zapsignDocs.length === 0 && (
                      <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" /> Carregando documentos...
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Anexos */}
              <div className="bg-card p-6 md:p-8 rounded-2xl shadow-sm border border-border/50">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                  <DownloadCloud className="w-5 h-5 text-amber-600" /> Anexar Documentos
                </h2>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8">
                  {["Folha de rosto", "Procuração", "Docs Pessoais", "Residência", "Fato gerador", "Cert. Casamento", "Cert. Óbito", "Provas rurais", "Laudo médico", "Outros"].map(tipo => (
                    <button type="button" key={tipo} disabled={!isOnline} onClick={() => handleFileUpload(tipo)} title={!isOnline ? "Requer internet" : undefined} className="p-4 rounded-xl border border-amber-500/20 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-500/40 transition-all font-semibold flex flex-col items-center justify-center gap-2 text-center h-24 disabled:opacity-50">
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

                {/* Sincronizar com Promarcos — só aparece se o cliente tem código Promarcos */}
                {promarcosCodigo && !editingProcesso && (
                  <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="sincPromarcos"
                        checked={!!novoProcesso.sincronizarPromarcos}
                        onChange={e => setNovoProcesso((p: any) => ({ ...p, sincronizarPromarcos: e.target.checked }))}
                        className="w-5 h-5 rounded border-border accent-primary cursor-pointer"
                      />
                      <label htmlFor="sincPromarcos" className="font-semibold cursor-pointer text-sm text-primary select-none">
                        Criar também no Promarcos
                      </label>
                    </div>
                    {novoProcesso.sincronizarPromarcos && (
                      <div className="space-y-3 pt-1">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Escritório (Promarcos)</label>
                          <select
                            value={novoProcesso.localPromarkosEscritorioid}
                            onChange={e => setNovoProcesso((p: any) => ({ ...p, localPromarkosEscritorioid: Number(e.target.value) }))}
                            className="w-full px-3 py-2.5 rounded-xl border-2 border-border focus:border-primary outline-none bg-background text-sm"
                          >
                            <option value={0}>Selecione o escritório...</option>
                            {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Categoria do Benefício</label>
                            <select
                              value={novoProcesso.localPromarkosBeneficioidCat}
                              onChange={e => setNovoProcesso((p: any) => ({ ...p, localPromarkosBeneficioidCat: Number(e.target.value), localPromarkosBeneficioid: 0 }))}
                              className="w-full px-3 py-2.5 rounded-xl border-2 border-border focus:border-primary outline-none bg-background text-sm"
                            >
                              <option value={0}>Selecione...</option>
                              {beneficios.map(b => <option key={b.id} value={b.id}>{b.descricao}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo do Benefício</label>
                            <select
                              value={novoProcesso.localPromarkosBeneficioid}
                              onChange={e => setNovoProcesso((p: any) => ({ ...p, localPromarkosBeneficioid: Number(e.target.value) }))}
                              disabled={novoProcesso.localPromarkosBeneficioidCat === 0 || beneficioTipos.length === 0}
                              className="w-full px-3 py-2.5 rounded-xl border-2 border-border focus:border-primary outline-none bg-background text-sm disabled:opacity-50"
                            >
                              <option value={0}>Selecione...</option>
                              {beneficioTipos.map(t => <option key={t.id} value={t.id}>{t.descricao}</option>)}
                            </select>
                          </div>
                        </div>
                        {novoProcesso.localPromarkosEscritorioid === 0 || novoProcesso.localPromarkosBeneficioid === 0 ? (
                          <p className="text-xs text-amber-600">Selecione escritório e tipo de benefício para habilitar a criação no Promarcos.</p>
                        ) : (
                          <p className="text-xs text-green-600">Ao salvar, o processo será criado tanto localmente quanto no Promarcos.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 flex-shrink-0">
                <button type="button" onClick={() => setProcessoModalOpen(false)} className="px-5 py-2.5 font-semibold text-muted-foreground hover:bg-muted rounded-xl transition-colors">Cancelar</button>
                <button type="button" onClick={handleCreateProcesso} className="px-8 py-2.5 font-bold bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors shadow-lg">Salvar Processo</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Novo Processo no Promarcos */}
      <AnimatePresence>
        {isPromarkosProcessoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-border max-h-[92vh] flex flex-col">
              
              {/* Header */}
              <div className="p-5 border-b border-border/50 bg-card flex-shrink-0 flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-base font-bold">{editingPromarkosProcesso ? `Editar Processo #${editingPromarkosProcesso.numeropasta ?? editingPromarkosProcesso.id}` : "Novo Processo"}</h3>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto">

                {/* Row 1: Número do Processo + Data entrada + Fluxo + Estágio + Urgência */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-end">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Número do Processo</label>
                    <input
                      type="text"
                      placeholder="Número do Processo"
                      value={novoPromarkosProcesso.numeroprocesso}
                      onChange={e => setNovoPromarkosProcesso(p => ({ ...p, numeroprocesso: e.target.value }))}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Data entrada</label>
                    <input
                      type="date"
                      value={novoPromarkosProcesso.dataentrada}
                      onChange={e => setNovoPromarkosProcesso(p => ({ ...p, dataentrada: e.target.value }))}
                      className="px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Fluxo</label>
                    <select
                      value={novoPromarkosProcesso.fluxo}
                      onChange={e => setNovoPromarkosProcesso(p => ({ ...p, fluxo: e.target.value }))}
                      className="px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-background"
                    >
                      <option value="Analise">Analise</option>
                      <option value="Judicial">Judicial</option>
                      <option value="Administrativo">Administrativo</option>
                      <option value="Recursal">Recursal</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Estágio</label>
                    <select
                      value={novoPromarkosProcesso.estagio}
                      onChange={e => setNovoPromarkosProcesso(p => ({ ...p, estagio: e.target.value }))}
                      className="px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-background"
                    >
                      <option value="Triagem">Triagem</option>
                      <option value="Protocolo">Protocolo</option>
                      <option value="Distribuído">Distribuído</option>
                      <option value="Em andamento">Em andamento</option>
                      <option value="Concluído">Concluído</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pb-1">
                    <input
                      type="checkbox"
                      id="pm-urgencia"
                      checked={novoPromarkosProcesso.urgencia}
                      onChange={e => setNovoPromarkosProcesso(p => ({ ...p, urgencia: e.target.checked }))}
                      className="w-4 h-4 accent-primary cursor-pointer"
                    />
                    <label htmlFor="pm-urgencia" className="text-sm font-medium cursor-pointer whitespace-nowrap">Urgência</label>
                  </div>
                </div>

                {/* Observações do Processo (expandable) */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowObservacoes(v => !v)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    <span className="text-lg leading-none">+</span> Observações do Processo
                  </button>
                  {showObservacoes ? (
                    <textarea
                      value={novoPromarkosProcesso.observacoes}
                      onChange={e => setNovoPromarkosProcesso(p => ({ ...p, observacoes: e.target.value }))}
                      rows={3}
                      placeholder="Observações do processo..."
                      className="mt-2 w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-background resize-none"
                    />
                  ) : (
                    <div className="mt-2 p-4 border border-border rounded-lg bg-muted/20 text-sm text-muted-foreground text-center">
                      Clique em "Observação do processo" para adicionar.
                    </div>
                  )}
                </div>

                {/* Fato Gerador */}
                <div className="space-y-2">
                  <button
                    type="button"
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    <span className="text-lg leading-none">+</span> Novo Fato Gerador
                  </button>
                  <div className="relative">
                    <label className="absolute -top-2 left-3 text-xs text-muted-foreground bg-card px-1">Fato gerador</label>
                    <input
                      type="text"
                      value={novoPromarkosProcesso.fatogerador}
                      onChange={e => setNovoPromarkosProcesso(p => ({ ...p, fatogerador: e.target.value }))}
                      className="w-full px-3 py-3 border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-background"
                    />
                  </div>
                </div>

                {/* Indicadores */}
                <div className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-base font-semibold text-primary">Indicadores</span>
                    {processoIndicadores.length > 0 && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{processoIndicadores.length} cadastrado{processoIndicadores.length > 1 ? "s" : ""}</span>
                    )}
                  </div>
                  {loadingComissoes ? (
                    <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                  ) : processoIndicadores.length > 0 ? (
                    <ul className="space-y-1">
                      {processoIndicadores.map(ind => (
                        <li key={ind.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0 group">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-primary">
                              {ind.Indicador.Nome.charAt(0)}
                            </div>
                            <span className="font-medium text-foreground truncate">{ind.Indicador.Nome}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{ind.percentual ?? 0}%</span>
                            <button type="button" onClick={() => handleRemoverIndicador(ind.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition-all" title="Remover">
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : !editingPromarkosProcesso ? (
                    <p className="text-sm text-muted-foreground">Salve o processo para adicionar indicadores.</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum indicador cadastrado.</p>
                  )}
                  {editingPromarkosProcesso && (
                    <div className="pt-2 border-t border-border/40 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Adicionar indicador</p>
                      <div className="flex gap-2 items-start">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            placeholder="Buscar por nome..."
                            value={novoIndTermo}
                            onChange={e => { setNovoIndTermo(e.target.value); setNovoIndSelecionado(null); }}
                            className="w-full px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none bg-background"
                          />
                          {novoIndResultados.length > 0 && (
                            <div className="absolute top-full left-0 z-50 w-full bg-card border border-border rounded-lg shadow-xl mt-0.5 max-h-44 overflow-y-auto">
                              {novoIndResultados.map(p => (
                                <button key={p.codigo} type="button" onClick={() => { setNovoIndSelecionado(p); setNovoIndTermo(p.razao_social); setNovoIndResultados([]); }} className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary flex-shrink-0">{p.razao_social.charAt(0)}</div>
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-xs">{p.razao_social}</p>
                                    <p className="text-[10px] text-muted-foreground">{p.cpf}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="relative w-16 flex-shrink-0">
                          <label className="absolute -top-2 left-2 text-[9px] text-muted-foreground bg-card px-0.5">%</label>
                          <input type="number" min={0} max={100} value={novoIndPercentual} onChange={e => setNovoIndPercentual(Number(e.target.value))} className="w-full px-2 py-2 border border-border rounded text-sm focus:border-primary outline-none bg-background text-center" />
                        </div>
                        <button type="button" onClick={handleAdicionarIndicador} disabled={!novoIndSelecionado || adicionandoInd} className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex-shrink-0 flex items-center justify-center" style={{ minWidth: 36 }}>
                          {adicionandoInd ? <Loader2 className="w-4 h-4 animate-spin" /> : "+"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sócios / Parceiro */}
                <div className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-base font-semibold text-primary">Sócios/ Parceiro</span>
                    {processoSocios.length > 0 && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{processoSocios.length} cadastrado{processoSocios.length > 1 ? "s" : ""}</span>
                    )}
                  </div>
                  {loadingComissoes ? (
                    <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                  ) : processoSocios.length > 0 ? (
                    <ul className="space-y-1">
                      {processoSocios.map(s => (
                        <li key={s.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0 group">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-blue-600">
                              {s.socios.razao_social.charAt(0)}
                            </div>
                            <span className="font-medium text-foreground truncate">{s.socios.razao_social}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs font-semibold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-full">{s.percentual ?? 0}%</span>
                            <button type="button" onClick={() => handleRemoverSocio(s.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition-all" title="Remover">
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : !editingPromarkosProcesso ? (
                    <p className="text-sm text-muted-foreground">Salve o processo para adicionar sócios.</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum sócio cadastrado.</p>
                  )}
                  {editingPromarkosProcesso && (
                    <div className="pt-2 border-t border-border/40 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Adicionar sócio / parceiro</p>
                      <div className="flex gap-2 items-start">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            placeholder="Buscar por nome..."
                            value={novoSocioTermo}
                            onChange={e => { setNovoSocioTermo(e.target.value); setNovoSocioSelecionado(null); }}
                            className="w-full px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none bg-background"
                          />
                          {novoSocioResultados.length > 0 && (
                            <div className="absolute top-full left-0 z-50 w-full bg-card border border-border rounded-lg shadow-xl mt-0.5 max-h-44 overflow-y-auto">
                              {novoSocioResultados.map(p => (
                                <button key={p.codigo} type="button" onClick={() => { setNovoSocioSelecionado(p); setNovoSocioTermo(p.razao_social); setNovoSocioResultados([]); }} className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center text-[9px] font-bold text-blue-600 flex-shrink-0">{p.razao_social.charAt(0)}</div>
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-xs">{p.razao_social}</p>
                                    <p className="text-[10px] text-muted-foreground">{p.cpf}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="relative w-16 flex-shrink-0">
                          <label className="absolute -top-2 left-2 text-[9px] text-muted-foreground bg-card px-0.5">%</label>
                          <input type="number" min={0} max={100} value={novoSocioPercentual} onChange={e => setNovoSocioPercentual(Number(e.target.value))} className="w-full px-2 py-2 border border-border rounded text-sm focus:border-primary outline-none bg-background text-center" />
                        </div>
                        <button type="button" onClick={handleAdicionarSocio} disabled={!novoSocioSelecionado || adicionandoSocio} className="px-3 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex-shrink-0 flex items-center justify-center" style={{ minWidth: 36 }}>
                          {adicionandoSocio ? <Loader2 className="w-4 h-4 animate-spin" /> : "+"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom row: Escritório + Benefício + Tipo benefício */}
                <div className="border border-border rounded-lg p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="relative">
                      <label className="absolute -top-2 left-2 text-[10px] text-muted-foreground bg-card px-0.5">Escritório</label>
                      <select
                        value={novoPromarkosProcesso.escritorioid}
                        onChange={e => setNovoPromarkosProcesso(p => ({ ...p, escritorioid: Number(e.target.value) }))}
                        className="w-full px-3 py-2.5 border border-border rounded text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-background"
                      >
                        <option value={0}>Selecione...</option>
                        {empresas.map(e => (
                          <option key={e.id} value={e.id}>{e.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div className="relative">
                      <label className="absolute -top-2 left-2 text-[10px] text-muted-foreground bg-card px-0.5">Benefício</label>
                      <select
                        value={novoPromarkosProcesso.beneficioid_categoria}
                        onChange={e => handleBeneficioCategoriaChange(Number(e.target.value))}
                        className="w-full px-3 py-2.5 border border-border rounded text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-background"
                      >
                        <option value={0}>Selecione...</option>
                        {beneficios.map(b => (
                          <option key={b.id} value={b.id}>{b.descricao}</option>
                        ))}
                      </select>
                    </div>
                    <div className="relative">
                      <label className="absolute -top-2 left-2 text-[10px] text-muted-foreground bg-card px-0.5">Tipo benefício</label>
                      {novoPromarkosProcesso.beneficioid_categoria > 0 && beneficioTipos.length === 0 ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 border border-border rounded bg-muted/30">
                          <Loader2 className="w-3 h-3 animate-spin" /> Carregando...
                        </div>
                      ) : (
                        <select
                          value={novoPromarkosProcesso.beneficioid}
                          onChange={e => setNovoPromarkosProcesso(p => ({ ...p, beneficioid: Number(e.target.value) }))}
                          disabled={novoPromarkosProcesso.beneficioid_categoria === 0}
                          className="w-full px-3 py-2.5 border border-border rounded text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-background disabled:opacity-50"
                        >
                          <option value={0}>Selecione...</option>
                          {beneficioTipos.map(t => (
                            <option key={t.id} value={t.id}>{t.descricao || "(sem descrição)"}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                  {/* Nº Pasta */}
                  <div className="mt-3 w-36 relative">
                    <label className="absolute -top-2 left-2 text-[10px] text-muted-foreground bg-card px-0.5">Nº Pasta</label>
                    <input
                      type="text"
                      value={novoPromarkosProcesso.numeropasta}
                      onChange={e => setNovoPromarkosProcesso(p => ({ ...p, numeropasta: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-border rounded text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-background"
                    />
                  </div>
                  {/* Usuário Promarcos */}
                  <div className="mt-3 w-36 relative">
                    <label className="absolute -top-2 left-2 text-[10px] text-muted-foreground bg-card px-0.5">Cód. Usuário</label>
                    <input
                      type="number"
                      value={novoPromarkosProcesso.usuariocadastro}
                      onChange={e => setNovoPromarkosProcesso(p => ({ ...p, usuariocadastro: Number(e.target.value) }))}
                      className="w-full px-3 py-2.5 border border-border rounded text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-background"
                    />
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border/50 flex justify-end gap-3 flex-shrink-0">
                <button type="button" onClick={() => setPromarkosProcessoModalOpen(false)} className="px-5 py-2.5 font-semibold text-muted-foreground hover:bg-muted rounded-lg transition-colors text-sm">Cancelar</button>
                <button type="button" onClick={handleCriarPromarkosProcesso} className="px-8 py-2.5 font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-lg text-sm">
                  {editingPromarkosProcesso ? "Salvar Alterações" : "Criar Processo"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Scanner Modal */}
      <AnimatePresence>
        {scannerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              className="w-full h-full md:w-auto md:h-auto md:max-w-sm md:max-h-[90vh] md:rounded-2xl overflow-hidden shadow-2xl bg-black flex flex-col"
              style={{ minHeight: "min(100vh, 640px)" }}
            >
              <DocumentScanner
                tipoDcumento={scannerModal.tipo}
                clienteNome={clientData?.nomeCompleto || ""}
                onUpload={handleDocScannerUpload}
                onClose={() => {
                  setScannerModal(null);
                  setCapturedFiles([]);
                  setCapturedPreviews([]);
                  setUploadDone(false);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </Layout>
  );
}
