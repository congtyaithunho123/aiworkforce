import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { agentsTable } from "./agents";

export const promptVersionsTable = pgTable("prompt_versions", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  agentId: integer("agent_id")
    .references(() => agentsTable.id, { onDelete: "cascade" })
    .notNull(),
  version: integer("version").notNull().default(1),
  systemPrompt: text("system_prompt").notNull(),
  changeNote: text("change_note"),
  isActive: boolean("is_active").notNull().default(false),
  // Metrics for this version (updated async)
  executionCount: integer("execution_count").notNull().default(0),
  avgQualityScore: integer("avg_quality_score"),
  createdBy: integer("created_by"), // userId
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPromptVersionSchema = createInsertSchema(promptVersionsTable).omit({ id: true, createdAt: true });
export type PromptVersion = typeof promptVersionsTable.$inferSelect;
export type InsertPromptVersion = z.infer<typeof insertPromptVersionSchema>;
