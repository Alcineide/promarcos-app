import React, { createContext, useCallback, useContext, useState } from "react";

export interface QueuedDoc {
  id: string;
  clienteId: string;
  clienteNome: string;
  categoria: string;
  categoriaNome: string;
  pages: { id: string; uri: string }[];
  addedAt: Date;
}

interface ScanQueueContextValue {
  queue: QueuedDoc[];
  addToQueue: (doc: Omit<QueuedDoc, "id" | "addedAt">) => void;
  removeFromQueue: (docId: string) => void;
  clearClientQueue: (clienteId: string) => void;
  clearAll: () => void;
}

const ScanQueueContext = createContext<ScanQueueContextValue | null>(null);

export function ScanQueueProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueuedDoc[]>([]);

  const addToQueue = useCallback((doc: Omit<QueuedDoc, "id" | "addedAt">) => {
    const newDoc: QueuedDoc = {
      ...doc,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
      addedAt: new Date(),
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

  return (
    <ScanQueueContext.Provider value={{ queue, addToQueue, removeFromQueue, clearClientQueue, clearAll }}>
      {children}
    </ScanQueueContext.Provider>
  );
}

export function useScanQueue() {
  const ctx = useContext(ScanQueueContext);
  if (!ctx) throw new Error("useScanQueue must be used inside ScanQueueProvider");
  return ctx;
}
