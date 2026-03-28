import { pgTable, text, serial, timestamp, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";

export const tipoAcaoPgEnum = pgEnum("tipo_acao_enum", [
  "consulta",
  "alteracao",
  "cadastro_novo",
  "upload_documento",
  "pesquisa_cpf",
]);

export const tipoAcaoValues = [
  "consulta",
  "alteracao",
  "cadastro_novo",
  "upload_documento",
  "pesquisa_cpf",
] as const;

export type TipoAcao = (typeof tipoAcaoValues)[number];

export const auditLogTable = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  colaboradorEmail: text("colaborador_email").notNull(),
  colaboradorCodigo: integer("colaborador_codigo"),
  cpfConsultado: text("cpf_consultado"),
  tipoAcao: tipoAcaoPgEnum("tipo_acao").notNull(),
  haviacadastro: text("havia_cadastro"),
  camposAlterados: jsonb("campos_alterados"),
  termoBuscado: text("termo_buscado"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  dataHora: timestamp("data_hora", { withTimezone: true }).notNull().defaultNow(),
  deviceId: text("device_id"),
  syncStatus: text("sync_status").default("synced"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
});

export type AuditLog = typeof auditLogTable.$inferSelect;
export type InsertAuditLog = typeof auditLogTable.$inferInsert;
