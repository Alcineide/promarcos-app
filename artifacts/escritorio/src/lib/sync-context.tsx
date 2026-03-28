import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import {
  getPendingSubmissions,
  getPendingCount,
  updateSubmissionStatus,
  removeSubmission,
  type PendingSubmission,
} from "./offline-db";
import { useOnlineStatus } from "@/hooks/use-online-status";

interface SyncQueueContextType {
  pendingCount: number;
  isSyncing: boolean;
  submissions: PendingSubmission[];
  refreshQueue: () => Promise<void>;
  syncNow: () => Promise<void>;
  removeItem: (id: number) => Promise<void>;
}

const SyncQueueContext = createContext<SyncQueueContextType | null>(null);

export function SyncQueueProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const isOnline = useOnlineStatus();

  const refreshQueue = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
    const subs = await getPendingSubmissions();
    setSubmissions(subs);
  }, []);

  const syncOne = useCallback(async (submission: PendingSubmission): Promise<boolean> => {
    if (!submission.id) return false;
    if (submission.retryCount >= 5) return false;
    await updateSubmissionStatus(submission.id, "syncing");

    try {
      const res = await fetch("/api/clientes/offline-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission.formData),
      });
      if (!res.ok) {
        const text = await res.text();
        await updateSubmissionStatus(submission.id, "failed", text);
        return false;
      }
      await removeSubmission(submission.id);
      return true;
    } catch (err) {
      await updateSubmissionStatus(
        submission.id,
        "failed",
        err instanceof Error ? err.message : "Erro desconhecido",
      );
      return false;
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncing || !navigator.onLine) return;
    setIsSyncing(true);
    try {
      const pending = await getPendingSubmissions();
      const toSync = pending.filter((s) => s.status === "pending" || s.status === "failed");
      for (const sub of toSync) {
        await syncOne(sub);
      }
    } finally {
      setIsSyncing(false);
      await refreshQueue();
    }
  }, [isSyncing, syncOne, refreshQueue]);

  const removeItem = useCallback(
    async (id: number) => {
      await removeSubmission(id);
      await refreshQueue();
    },
    [refreshQueue],
  );

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      const timer = setTimeout(() => syncNow(), 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOnline, pendingCount, syncNow]);

  return (
    <SyncQueueContext.Provider
      value={{ pendingCount, isSyncing, submissions, refreshQueue, syncNow, removeItem }}
    >
      {children}
    </SyncQueueContext.Provider>
  );
}

export function useSyncQueue() {
  const ctx = useContext(SyncQueueContext);
  if (!ctx) throw new Error("useSyncQueue must be used within SyncQueueProvider");
  return ctx;
}
