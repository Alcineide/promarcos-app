import { Platform } from "react-native";
import { getPendingRecords, markAsSynced } from "./audit-db";
import { API_BASE } from "@/config/api";

const AUDIT_SYNC_KEY = process.env.EXPO_PUBLIC_AUDIT_SYNC_KEY || "";

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

async function isConnected(): Promise<boolean> {
  try {
    const NetInfo = await import("@react-native-community/netinfo");
    const state = await NetInfo.default.fetch();
    return state.isConnected === true;
  } catch {
    return true;
  }
}

async function syncPendingRecords(): Promise<void> {
  if (isSyncing) return;
  if (Platform.OS === "web") return;

  isSyncing = true;
  try {
    const connected = await isConnected();
    if (!connected) return;

    const pending = await getPendingRecords();
    if (pending.length === 0) return;

    const registros = pending.map((r) => ({
      colaborador_email: r.colaborador_email,
      colaborador_codigo: r.colaborador_codigo,
      cpf_consultado: r.cpf_consultado,
      tipo_acao: r.tipo_acao,
      havia_cadastro: r.havia_cadastro,
      campos_alterados: r.campos_alterados ? JSON.parse(r.campos_alterados) : null,
      termo_buscado: r.termo_buscado,
      latitude: r.latitude,
      longitude: r.longitude,
      data_hora: r.data_hora,
      device_id: r.device_id,
    }));

    const res = await fetch(`${API_BASE}/audit/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-audit-sync-key": AUDIT_SYNC_KEY,
      },
      body: JSON.stringify({ registros }),
    });

    if (res.ok) {
      const ids = pending.map((r) => r.id!).filter(Boolean);
      await markAsSynced(ids);
    }
  } catch {
  } finally {
    isSyncing = false;
  }
}

export function startAuditSync(): void {
  if (Platform.OS === "web") return;
  if (syncInterval) return;

  syncPendingRecords();

  syncInterval = setInterval(syncPendingRecords, 60000);
}

export function stopAuditSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

export { syncPendingRecords };
