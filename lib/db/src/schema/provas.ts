import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const provasTable = pgTable("provas", {
  id: serial("id").primaryKey(),
  cpf: text("cpf").notNull(),
  tipoProva: text("tipo_prova").notNull().default(""),
  descricaoProva: text("descricao_prova").notNull().default(""),
  dataProva: text("data_prova"),
  idProva: text("id_prova"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProvaSchema = createInsertSchema(provasTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProva = z.infer<typeof insertProvaSchema>;
export type Prova = typeof provasTable.$inferSelect;
