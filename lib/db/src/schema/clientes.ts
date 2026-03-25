import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientesTable = pgTable("clientes", {
  id: serial("id").primaryKey(),
  escritorio: text("escritorio").notNull().default(""),
  cpf: text("cpf").notNull(),
  nomeCompleto: text("nome_completo").notNull(),
  dataNascimento: text("data_nascimento"),
  sexo: text("sexo"),
  estadoCivil: text("estado_civil"),
  rgRepresentante: text("rg_representante"),
  orgaoEmissor: text("orgao_emissor"),
  profissao: text("profissao"),
  telefone: text("telefone"),
  telefone2: text("telefone2"),
  email: text("email"),
  cep: text("cep"),
  estado: text("estado"),
  cidade: text("cidade"),
  logradouro: text("logradouro"),
  numero: text("numero"),
  complemento: text("complemento"),
  bairro: text("bairro"),
  observacao: text("observacao"),
  pastaPath: text("pasta_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClienteSchema = createInsertSchema(clientesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCliente = z.infer<typeof insertClienteSchema>;
export type Cliente = typeof clientesTable.$inferSelect;
