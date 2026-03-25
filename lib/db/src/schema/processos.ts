import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientesTable } from "./clientes";

export const processosTable = pgTable("processos", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").notNull().references(() => clientesTable.id, { onDelete: "cascade" }),
  numero: text("numero"),
  vara: text("vara"),
  comarca: text("comarca"),
  assunto: text("assunto"),
  status: text("status").notNull().default("Ativo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProcessoSchema = createInsertSchema(processosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProcesso = z.infer<typeof insertProcessoSchema>;
export type Processo = typeof processosTable.$inferSelect;
