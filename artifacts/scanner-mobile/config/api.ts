const DOMAIN =
  process.env.EXPO_PUBLIC_DOMAIN ||
  "office-client-manager--marcosaurelionu.replit.app";

export const API_BASE = `https://${DOMAIN}/api`;

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg =
      (data as { mensagem?: string; message?: string })?.mensagem ||
      (data as { mensagem?: string; message?: string })?.message ||
      "Erro na requisição";
    throw new Error(msg);
  }
  return data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json();
  if (!res.ok) {
    const msg =
      (data as { mensagem?: string; message?: string })?.mensagem ||
      (data as { mensagem?: string; message?: string })?.message ||
      "Erro na requisição";
    throw new Error(msg);
  }
  return data as T;
}
