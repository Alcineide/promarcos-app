import * as FileSystem from "expo-file-system/src/legacy/FileSystem";
import { EncodingType } from "expo-file-system/src/legacy/FileSystem.types";
import * as Print from "expo-print";
import NetInfo from "@react-native-community/netinfo";

import { apiPost } from "@/config/api";
import type { QueuedDoc, UploadStatus } from "@/contexts/ScanQueue";

type StatusUpdater = (docId: string, status: UploadStatus, error?: string) => void;

let isSyncing = false;
let queueRef: QueuedDoc[] = [];
let updateStatusRef: StatusUpdater | null = null;

export function setSyncRefs(queue: QueuedDoc[], updateStatus: StatusUpdater) {
  queueRef = queue;
  updateStatusRef = updateStatus;
}

export function isSyncActive() {
  return isSyncing;
}

export function acquireSyncLock(): boolean {
  if (isSyncing) return false;
  isSyncing = true;
  return true;
}

export function releaseSyncLock() {
  isSyncing = false;
}

async function buildPdfBase64(doc: QueuedDoc): Promise<{ base64: string; fileName: string }> {
  const base64Images = await Promise.all(
    doc.pages.map(async (page) => {
      const b64 = await FileSystem.readAsStringAsync(page.uri, { encoding: EncodingType.Base64 });
      const ext = page.uri.split(".").pop()?.toLowerCase() ?? "jpg";
      const mime = ext === "png" ? "image/png" : "image/jpeg";
      return { b64, mime };
    })
  );

  const pageHtml = base64Images.map(
    ({ b64, mime }) =>
      `<div style="page-break-after:always;width:100%;height:100vh;display:flex;align-items:center;justify-content:center;margin:0;padding:0;">
        <img src="data:${mime};base64,${b64}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
      </div>`
  );

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#fff;}</style></head><body>${pageHtml.join("")}</body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  const pdfBase64 = await FileSystem.readAsStringAsync(uri, { encoding: EncodingType.Base64 });

  const nomeCliente = (doc.clienteNome ?? "cliente").toUpperCase().replace(/\s+/g, "_");
  const fileName = `${nomeCliente}_${doc.categoriaNome.replace(/\s+/g, "_")}_${Date.now()}.pdf`;

  return { base64: pdfBase64, fileName };
}

async function uploadSingleDoc(doc: QueuedDoc): Promise<void> {
  let base64: string;
  let fileName: string;

  if (doc.pdfBase64 && doc.pdfFileName) {
    base64 = doc.pdfBase64;
    fileName = doc.pdfFileName;
  } else {
    const built = await buildPdfBase64(doc);
    base64 = built.base64;
    fileName = built.fileName;
  }

  const nomeCliente = (doc.clienteNome ?? "").trim() || "Cliente";

  await apiPost("/promarcos/arquivo", {
    pessoaCodigo: parseInt(doc.clienteId, 10),
    fileName,
    fileBase64: base64,
    tipo: doc.categoriaNome,
    nome: `${doc.categoriaNome} - ${nomeCliente}`,
    mimeType: "application/pdf",
  });
}

export async function processUploadQueue(): Promise<{ synced: number; failed: number }> {
  if (isSyncing) return { synced: 0, failed: 0 };

  const netState = await NetInfo.fetch();
  if (!netState.isConnected || netState.isInternetReachable === false) {
    return { synced: 0, failed: 0 };
  }

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const now = Date.now();
    const pending = queueRef.filter((d) => {
      if (d.uploadStatus === "pending") return true;
      if (d.uploadStatus === "failed") {
        return !d.nextRetryAt || d.nextRetryAt <= now;
      }
      return false;
    });

    for (const doc of pending) {
      if (!updateStatusRef) break;

      const netCheck = await NetInfo.fetch();
      if (!netCheck.isConnected) break;

      updateStatusRef(doc.id, "syncing");

      try {
        await uploadSingleDoc(doc);
        updateStatusRef(doc.id, "synced");
        synced++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        updateStatusRef(doc.id, "failed", msg);
        failed++;
      }
    }
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoSync() {
  if (syncInterval) return;

  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      processUploadQueue();
    }
  });

  syncInterval = setInterval(() => {
    processUploadQueue();
  }, 60_000);

  return () => {
    unsubscribe();
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  };
}

export function triggerSync() {
  processUploadQueue();
}
