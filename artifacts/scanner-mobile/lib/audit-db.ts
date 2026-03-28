import { Platform } from "react-native";
import type { SQLiteDatabase } from "expo-sqlite";

export interface AuditRecord {
  id?: number;
  colaborador_email: string;
  colaborador_codigo?: number;
  cpf_consultado?: string;
  tipo_acao: string;
  havia_cadastro?: string;
  campos_alterados?: string;
  termo_buscado?: string;
  latitude?: string;
  longitude?: string;
  data_hora: string;
  device_id?: string;
  sync_status: string;
}

let dbInstance: SQLiteDatabase | null = null;

async function getDb(): Promise<SQLiteDatabase | null> {
  if (Platform.OS === "web") return null;
  if (dbInstance) return dbInstance;

  try {
    const SQLite = await import("expo-sqlite");
    dbInstance = await SQLite.openDatabaseAsync("audit_log");
    await dbInstance.execAsync(`
      CREATE TABLE IF NOT EXISTS audit_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        colaborador_email TEXT NOT NULL,
        colaborador_codigo INTEGER,
        cpf_consultado TEXT,
        tipo_acao TEXT NOT NULL,
        havia_cadastro TEXT,
        campos_alterados TEXT,
        termo_buscado TEXT,
        latitude TEXT,
        longitude TEXT,
        data_hora TEXT NOT NULL,
        device_id TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending'
      );
    `);
    return dbInstance;
  } catch {
    return null;
  }
}

export async function insertAuditRecord(record: Omit<AuditRecord, "id" | "sync_status">): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.runAsync(
      `INSERT INTO audit_records (
        colaborador_email, colaborador_codigo, cpf_consultado, tipo_acao,
        havia_cadastro, campos_alterados, termo_buscado,
        latitude, longitude, data_hora, device_id, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        record.colaborador_email,
        record.colaborador_codigo ?? null,
        record.cpf_consultado ?? null,
        record.tipo_acao,
        record.havia_cadastro ?? null,
        record.campos_alterados ?? null,
        record.termo_buscado ?? null,
        record.latitude ?? null,
        record.longitude ?? null,
        record.data_hora,
        record.device_id ?? null,
      ]
    );
  } catch {
  }
}

export async function getPendingRecords(): Promise<AuditRecord[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const rows = await db.getAllAsync(
      "SELECT * FROM audit_records WHERE sync_status = 'pending' ORDER BY id ASC LIMIT 100"
    );
    return rows as AuditRecord[];
  } catch {
    return [];
  }
}

export async function markAsSynced(ids: number[]): Promise<void> {
  const db = await getDb();
  if (!db || ids.length === 0) return;

  try {
    const placeholders = ids.map(() => "?").join(",");
    await db.runAsync(
      `DELETE FROM audit_records WHERE id IN (${placeholders})`,
      ids
    );
  } catch {
  }
}
