import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "@mendes/client-cache";
const MAX_CACHED = 50;

export interface CachedClient {
  codigo: number;
  nomecompleto: string;
  cpf?: string;
  nome?: string;
  cachedAt: number;
}

async function getAll(): Promise<CachedClient[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveAll(clients: CachedClient[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(clients.slice(0, MAX_CACHED)));
  } catch {}
}

export async function cacheClients(clients: Array<{ codigo: number; nomecompleto?: string; cpf?: string; nome?: string }>): Promise<void> {
  const existing = await getAll();
  const now = Date.now();

  for (const c of clients) {
    const idx = existing.findIndex((e) => e.codigo === c.codigo);
    const entry: CachedClient = {
      codigo: c.codigo,
      nomecompleto: c.nomecompleto || c.nome || "",
      cpf: c.cpf,
      nome: c.nome,
      cachedAt: now,
    };
    if (idx >= 0) {
      existing[idx] = entry;
    } else {
      existing.unshift(entry);
    }
  }

  existing.sort((a, b) => b.cachedAt - a.cachedAt);
  await saveAll(existing);
}

export async function searchCachedClients(termo: string): Promise<CachedClient[]> {
  const all = await getAll();
  const lower = termo.toLowerCase().replace(/\D/g, "");
  const isNumeric = /^\d+$/.test(termo.replace(/\D/g, ""));

  return all.filter((c) => {
    if (isNumeric && lower.length >= 3) {
      const cpfClean = (c.cpf || "").replace(/\D/g, "");
      if (cpfClean.includes(lower)) return true;
    }
    const name = (c.nomecompleto || c.nome || "").toLowerCase();
    return name.includes(termo.toLowerCase());
  });
}

export async function getCachedClients(): Promise<CachedClient[]> {
  return getAll();
}
