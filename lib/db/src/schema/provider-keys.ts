import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const providerKeysTable = pgTable("provider_keys", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  provider: text("provider").notNull().default("openai"), // openai, anthropic
  label: text("label").notNull().default("Default"),
  encryptedKey: text("encrypted_key").notNull(), // stored as-is (db-level security)
  keyPreview: text("key_preview").notNull(), // e.g. "sk-proj...Xk3f"
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProviderKeySchema = createInsertSchema(providerKeysTable).omit({ id: true, createdAt: true, updatedAt: true });
export type ProviderKey = typeof providerKeysTable.$inferSelect;
export type InsertProviderKey = z.infer<typeof insertProviderKeySchema>;
