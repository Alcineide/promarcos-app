import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientesTable } from "./clientes";

export const processosTable = pgTable("processos", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").notNull().references(() => clientesTable.id, { onDelete: "cascade" }),
  numeroPasta: text("numero_pasta"),
  numeroProcesso: text("numero_processo"),
  dataEntrada: text("data_entrada"),
  fluxo: text("fluxo"),
  estagio: text("estagio"),
  urgencia: boolean("urgencia").default(false),
  observacoes: text("observacoes"),
  fatoGerador: text("fato_gerador"),
  matricula: text("matricula"),
  dataFatoGerador: text("data_fato_gerador"),
  escritorioProcesso: text("escritorio_processo"),
  beneficio: text("beneficio"),
  tipoBeneficio: text("tipo_beneficio"),
  status: text("status").notNull().default("Ativo"),
  cadastradoPor: text("cadastrado_por"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProcessoSchema = createInsertSchema(processosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProcesso = z.infer<typeof insertProcessoSchema>;
export type Processo = typeof processosTable.$inferSelect;
