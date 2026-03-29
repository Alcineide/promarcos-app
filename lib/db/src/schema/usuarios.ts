import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const usuariosTable = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  nome: text("nome").notNull().default(""),
  role: text("role").notNull().default("user"),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
