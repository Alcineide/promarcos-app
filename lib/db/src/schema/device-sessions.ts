import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const deviceSessionsTable = pgTable("device_sessions", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  deviceId: text("device_id").notNull(),
  deviceName: text("device_name"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  ativo: boolean("ativo").notNull().default(true),
});

export type DeviceSession = typeof deviceSessionsTable.$inferSelect;
export type InsertDeviceSession = typeof deviceSessionsTable.$inferInsert;
