import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { clientesTable } from "./clientes";

export const documentosAssinaturaTable = pgTable("documentos_assinatura", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => clientesTable.id, { onDelete: "cascade" }),
  cpf: text("cpf").notNull(),
  tipoDocumento: text("tipo_documento").notNull(),
  nomeArquivo: text("nome_arquivo").notNull(),
  zapsignDocToken: text("zapsign_doc_token"),
  zapsignSignerToken: text("zapsign_signer_token"),
  statusAssinatura: text("status_assinatura").notNull().default("pendente"),
  urlPdfOriginal: text("url_pdf_original"),
  urlPdfAssinado: text("url_pdf_assinado"),
  signedFile: text("signed_file"),
  dataAssinatura: timestamp("data_assinatura", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
