import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "@mendes/scan-queue";

export type UploadStatus = "pending" | "syncing" | "synced" | "failed";

export interface QueuedDoc {
  id: string;
  clienteId: string;
  clienteNome: string;
  categoria: string;
  categoriaNome: string;
  pages: { id: string; uri: string }[];
  addedAt: string;
  uploadStatus: UploadStatus;
  lastError?: string;
  retryCount: number;
}

interface ScanQueueContextValue {
  queue: QueuedDoc[];
  addToQueue: (doc: Omit<QueuedDoc, "id" | "addedAt" | "uploadStatus" | "retryCount">) => void;
  removeFromQueue: (docId: string) => void;
  clearClientQueue: (clienteId: string) => void;
  clearAll: () => void;
  updateDocStatus: (docId: string, status: UploadStatus, error?: string) => void;
  markForRetry: (docId: string) => void;
  pendingCount: number;
  failedCount: number;
}

const ScanQueueContext = createContext<ScanQueueContextValue | null>(null);

function makeId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 6);
}

export function ScanQueueProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueuedDoc[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as QueuedDoc[];
          const restored = parsed
            .filter((d) => (d.uploadStatus ?? "pending") !== "synced")
            .map((d) => ({
              ...d,
              uploadStatus: (!d.uploadStatus || d.uploadStatus === "syncing") ? "pending" as UploadStatus : d.uploadStatus,
              retryCount: d.retryCount ?? 0,
              addedAt: d.addedAt ?? new Date().toISOString(),
            }));
          setQueue(restored);
        } catch {}
      }
      loaded.current = true;
    });
  }, []);

  useEffect(() => {
    if (loaded.current) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue)).catch(() => {});
    }
  }, [queue]);

  const addToQueue = useCallback((doc: Omit<QueuedDoc, "id" | "addedAt" | "uploadStatus" | "retryCount">) => {
    const newDoc: QueuedDoc = {
      ...doc,
      id: makeId(),
      addedAt: new Date().toISOString(),
      uploadStatus: "pending",
      retryCount: 0,
    };
    setQueue((prev) => [...prev, newDoc]);
  }, []);

  const removeFromQueue = useCallback((docId: string) => {
    setQueue((prev) => prev.filter((d) => d.id !== docId));
  }, []);

  const clearClientQueue = useCallback((clienteId: string) => {
    setQueue((prev) => prev.filter((d) => d.clienteId !== clienteId));
  }, []);

  const clearAll = useCallback(() => setQueue([]), []);

  const updateDocStatus = useCallback((docId: string, status: UploadStatus, error?: string) => {
    setQueue((prev) =>
      prev.map((d) =>
        d.id === docId
          ? {
              ...d,
              uploadStatus: status,
              lastError: error || d.lastError,
              retryCount: status === "failed" ? d.retryCount + 1 : d.retryCount,
            }
          : d
      ).filter((d) => d.uploadStatus !== "synced")
    );
  }, []);

  const markForRetry = useCallback((docId: string) => {
    setQueue((prev) =>
      prev.map((d) =>
        d.id === docId ? { ...d, uploadStatus: "pending" as UploadStatus, lastError: undefined } : d
      )
    );
  }, []);

  const pendingCount = queue.filter((d) => d.uploadStatus === "pending" || d.uploadStatus === "syncing").length;
  const failedCount = queue.filter((d) => d.uploadStatus === "failed").length;

  return (
    <ScanQueueContext.Provider
      value={{ queue, addToQueue, removeFromQueue, clearClientQueue, clearAll, updateDocStatus, markForRetry, pendingCount, failedCount }}
    >
      {children}
    </ScanQueueContext.Provider>
  );
}

export function useScanQueue() {
  const ctx = useContext(ScanQueueContext);
  if (!ctx) throw new Error("useScanQueue must be used inside ScanQueueProvider");
  return ctx;
}
