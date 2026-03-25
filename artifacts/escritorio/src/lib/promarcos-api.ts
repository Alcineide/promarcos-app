const PROXY_BASE = "/api/promarcos";

export interface PromarcosPessoa {
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
  ProcessoId: number;
  numeroprocesso: string;
  dataentrada: string | null;
  beneficio: string;
}

export interface PromarcosBuscaCpfResult {
  existe: boolean;
  pessoas: PromarcosPessoa[];
}

export async function buscarPorCpf(cpf: string): Promise<PromarcosBuscaCpfResult> {
  const cpfNumerico = cpf.replace(/\D/g, "");
  if (cpfNumerico.length !== 11) return { existe: false, pessoas: [] };
  const res = await fetch(`${PROXY_BASE}/buscarcpf/${cpfNumerico}`);
  if (!res.ok) return { existe: false, pessoas: [] };
  return res.json();
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
  Processos: any[];
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
