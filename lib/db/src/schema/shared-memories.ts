import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { agentsTable } from "./agents";

export const sharedMemoriesTable = pgTable("shared_memories", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  scope: text("scope").notNull().default("organization"),
  scopeId: integer("scope_id"),
  ownerAgentId: integer("owner_agent_id")
    .references(() => agentsTable.id, { onDelete: "set null" }),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  contentType: text("content_type").notNull().default("text"),
  ttlSeconds: integer("ttl_seconds"),
  accessCount: integer("access_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertSharedMemorySchema = createInsertSchema(sharedMemoriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSharedMemory = z.infer<typeof insertSharedMemorySchema>;
export type SharedMemory = typeof sharedMemoriesTable.$inferSelect;
