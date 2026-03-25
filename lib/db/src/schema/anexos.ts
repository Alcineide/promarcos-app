import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientesTable } from "./clientes";

export const anexosTable = pgTable("anexos", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").notNull().references(() => clientesTable.id, { onDelete: "cascade" }),
  tipo: text("tipo").notNull(),
  nomeArquivo: text("nome_arquivo").notNull(),
  fileData: text("file_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAnexoSchema = createInsertSchema(anexosTable).omit({ id: true, createdAt: true });
export type InsertAnexo = z.infer<typeof insertAnexoSchema>;
export type Anexo = typeof anexosTable.$inferSelect;
