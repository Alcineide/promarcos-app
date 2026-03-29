const DEVICE_ID_KEY = "promarcos_device_id";

function getDeviceId(): string {
  return localStorage.getItem(DEVICE_ID_KEY) || "unknown";
}

function getUserEmail(): string | null {
  try {
    const stored = sessionStorage.getItem("promarcos_session");
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.email || null;
    }
  } catch {}
  return null;
}

interface AuditParams {
  tipo_acao: "consulta" | "alteracao" | "cadastro_novo" | "upload_documento" | "pesquisa_cpf";
  cpf_consultado?: string;
  havia_cadastro?: string;
  campos_alterados?: Record<string, { old: unknown; new: unknown }>;
  termo_buscado?: string;
}

export function registrarAuditoria(params: AuditParams): void {
  const email = getUserEmail();
  if (!email) return;

  const body: Record<string, unknown> = {
    tipo_acao: params.tipo_acao,
    device_id: getDeviceId(),
  };

  if (params.cpf_consultado) body.cpf_consultado = params.cpf_consultado.replace(/\D/g, "");
  if (params.havia_cadastro) body.havia_cadastro = params.havia_cadastro;
  if (params.campos_alterados) body.campos_alterados = params.campos_alterados;
  if (params.termo_buscado) body.termo_buscado = params.termo_buscado;

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        body.latitude = String(pos.coords.latitude);
        body.longitude = String(pos.coords.longitude);
        enviar(email, body);
      },
      () => enviar(email, body),
      { timeout: 3000 }
    );
  } else {
    enviar(email, body);
  }
}

function enviar(email: string, body: Record<string, unknown>): void {
  fetch("/api/audit/log", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-email": email,
    },
    body: JSON.stringify(body),
  }).catch(() => {});
}
