const PROXY_BASE = "/api/promarcos";

export interface PromarkosEscritorio {
  id: number;
  nome: string;
  sigla: string;
  ativo: boolean | null;
  OrigemCliente: boolean | null;
}

export interface PromarkosPessoa {
  codigo: number;
  razao_social: string;
  cpf: string;
  estado_civil: string;
  nascimento: string | null;
  sexo: string;
  rg: string;
  orgaoemissor: string;
  profissao: string;
  cep: string;
  bairro: string;
  logradouro: string;
  numero: string;
  complemento: string;
  estadoId: number | null;
  cidadeId: number | null;
  email1: string;
  telefone1: string;
  telefone2: string | null;
  cidade: string | null;
  estado: string | null;
  observacoes: string;
  indicador: string | null;
}

export interface PromarkosProcesso {
  id: number;
  pessoaid: number;
  numeroprocesso: string;
  situacao: string;
  dataentrada: string | null;
  escritorio: string;
  escritorioid: number;
  beneficio: string;
  beneficioid: number;
  usuario: string;
  urgencia: boolean;
  nome: string;
  cpf: string;
  numeropasta: number | null;
  sigla: string;
  TipoBeneficio: string;
  AreaAtual: string;
  StatusAtual: string;
  CreatedAt: string;
  UpdatedAt: string;
  nomefatogerador: string | null;
  datafatogerador: string | null;
  matricula: string | null;
  analista: Array<{
    NomeAnalista: string;
    Etapa: string;
    PrazoEtapa: string | null;
    Comentario: string;
  }>;
}

export interface PromarkosBeneficio {
  id: number;
  descricao: string;
}

export interface PromarkosBeneficioTipo {
  id: number;
  descricao: string;
}

export interface PromarkosBuscaCpfResult {
  existe: boolean;
  pessoas: PromarkosPessoa[];
}

export async function buscarEscritorios(): Promise<PromarkosEscritorio[]> {
  try {
    const res = await fetch(`${PROXY_BASE}/escritorios`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data)
      ? data.filter((e: PromarkosEscritorio) => e.ativo !== false && !e.OrigemCliente)
      : [];
  } catch {
    return [];
  }
}

export async function buscarPorCpf(cpf: string): Promise<PromarkosBuscaCpfResult> {
  const cpfNumerico = cpf.replace(/\D/g, "");
  if (cpfNumerico.length !== 11) return { existe: false, pessoas: [] };
  const res = await fetch(`${PROXY_BASE}/buscarcpf/${cpfNumerico}`);
  if (!res.ok) return { existe: false, pessoas: [] };
  return res.json();
}

export async function buscarProcessos(pessoaId: number): Promise<PromarkosProcesso[]> {
  try {
    const res = await fetch(`${PROXY_BASE}/processos/${pessoaId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function buscarBeneficios(): Promise<PromarkosBeneficio[]> {
  try {
    const res = await fetch(`${PROXY_BASE}/beneficios`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function buscarBeneficioTipos(beneficioId: number): Promise<PromarkosBeneficioTipo[]> {
  try {
    const res = await fetch(`${PROXY_BASE}/beneficiotipo/${beneficioId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function criarProcessoPromarcos(data: {
  escritorioid: number;
  beneficioid: number;
  pessoaid: number;
  dataentrada: string;
  urgencia: boolean;
  modo: string;
  numeroprocesso?: string;
  fluxo?: string;
  estagio?: string;
  observacoes?: string;
  fatogerador?: string;
  numeropasta?: string;
  terrapropia?: boolean;
  incra?: boolean;
  vinculoemprego?: string;
}): Promise<{ sucesso: boolean; id?: number; mensagem?: string }> {
  try {
    const res = await fetch(`${PROXY_BASE}/processos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      return { sucesso: false, mensagem: (result?.message as string) || "Erro ao criar processo" };
    }
    return { sucesso: true, id: result?.processo_id as number | undefined };
  } catch {
    return { sucesso: false, mensagem: "Erro ao conectar com o Promarcos" };
  }
}

export interface SalvarPessoaPayload {
  Pessoa: {
    razao_social: string;
    cpf: string;
    rg: string;
    orgaoemissor?: string;
    estado_civil: string;
    nascimento: string | null;
    sexo: string;
    cep: string;
    bairro: string;
    logradouro: string;
    numero: string;
    complemento: string;
    estadoId: number | null;
    cidadeId: number | null;
    email1: string;
    telefone1: string;
    telefone2?: string;
    profissao: string;
    observacoes?: string;
    ativo: boolean;
    codempresa: number;
  };
  Processos: unknown[];
}

export async function salvarPessoa(payload: SalvarPessoaPayload): Promise<{ sucesso: boolean; codigo?: number; mensagem?: string; duplicado?: boolean }> {
  const res = await fetch(`${PROXY_BASE}/salvarpessoacompleta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    return { sucesso: false, mensagem: text };
  }
  return res.json();
}

export async function gerarFolhaRosto(pessoaId: number): Promise<{ sucesso: boolean; blob?: Blob; fileName?: string; mensagem?: string }> {
  try {
    const res = await fetch(`${PROXY_BASE}/folharosto/${pessoaId}`);
    if (!res.ok) {
      const text = await res.text();
      return { sucesso: false, mensagem: text || `Erro ${res.status}` };
    }
    const blob = await res.blob();
    const disposition = res.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="?([^";\s]+)"?/);
    const fileName = match?.[1] || `folha_rosto_${pessoaId}.pdf`;
    return { sucesso: true, blob, fileName };
  } catch (err) {
    return { sucesso: false, mensagem: "Erro ao conectar com o Promarcos" };
  }
}

export async function uploadArquivoPromarcos(pessoaCodigo: number, blob: Blob, fileName: string): Promise<{ sucesso: boolean; mensagem?: string }> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const res = await fetch(`${PROXY_BASE}/arquivo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pessoaCodigo, fileName, fileBase64: base64, tipo: "Folha de Rosto", nome: "Folha de Rosto" }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { sucesso: false, mensagem: text || `Erro ${res.status}` };
    }
    return { sucesso: true };
  } catch (err) {
    return { sucesso: false, mensagem: "Erro ao enviar arquivo ao Promarcos" };
  }
}
