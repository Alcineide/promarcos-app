import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "promarcos-offline";
const DB_VERSION = 1;

export interface PendingSubmission {
  id?: number;
  formData: Record<string, unknown>;
  createdAt: number;
  status: "pending" | "syncing" | "failed";
  lastError?: string;
  retryCount: number;
}

export interface CachedSearchResult {
  query: string;
  results: unknown[];
  cachedAt: number;
}

async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("pendingSubmissions")) {
        const store = db.createObjectStore("pendingSubmissions", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("status", "status");
      }
      if (!db.objectStoreNames.contains("cachedSearchResults")) {
        db.createObjectStore("cachedSearchResults", { keyPath: "query" });
      }
      if (!db.objectStoreNames.contains("syncMeta")) {
        db.createObjectStore("syncMeta", { keyPath: "key" });
      }
    },
  });
}

export async function addPendingSubmission(
  formData: Record<string, unknown>,
): Promise<number> {
  const db = await getDb();
  const submission: PendingSubmission = {
    formData,
    createdAt: Date.now(),
    status: "pending",
    retryCount: 0,
  };
  const id = await db.add("pendingSubmissions", submission);
  return id as number;
}

export async function getPendingSubmissions(): Promise<PendingSubmission[]> {
  const db = await getDb();
  return db.getAll("pendingSubmissions");
}

export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  const all = await db.getAll("pendingSubmissions");
  return all.filter((s: PendingSubmission) => s.status !== "syncing").length;
}

export async function updateSubmissionStatus(
  id: number,
  status: PendingSubmission["status"],
  lastError?: string,
): Promise<void> {
  const db = await getDb();
  const submission = await db.get("pendingSubmissions", id);
  if (submission) {
    submission.status = status;
    if (lastError) submission.lastError = lastError;
    if (status === "failed") submission.retryCount = (submission.retryCount || 0) + 1;
    await db.put("pendingSubmissions", submission);
  }
}

export async function removeSubmission(id: number): Promise<void> {
  const db = await getDb();
  await db.delete("pendingSubmissions", id);
}

export async function cacheSearchResults(
  query: string,
  results: unknown[],
): Promise<void> {
  const db = await getDb();
  await db.put("cachedSearchResults", {
    query: query.toLowerCase().trim(),
    results,
    cachedAt: Date.now(),
  });
}

export async function getCachedSearchResults(
  query: string,
): Promise<unknown[] | null> {
  const db = await getDb();
  const cached = await db.get(
    "cachedSearchResults",
    query.toLowerCase().trim(),
  );
  if (!cached) return null;
  const ONE_HOUR = 60 * 60 * 1000;
  if (Date.now() - cached.cachedAt > ONE_HOUR) return null;
  return cached.results;
}

export async function setSyncMeta(
  key: string,
  value: unknown,
): Promise<void> {
  const db = await getDb();
  await db.put("syncMeta", { key, value, updatedAt: Date.now() });
}

export async function getSyncMeta(key: string): Promise<unknown | null> {
  const db = await getDb();
  const meta = await db.get("syncMeta", key);
  return meta?.value ?? null;
}
