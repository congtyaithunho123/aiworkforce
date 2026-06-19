import { pgTable, serial, text, integer, timestamp, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const agentRegistryTable = pgTable("agent_registry", {
  id: serial("id").primaryKey(),
  ownerOrganizationId: integer("owner_organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  version: text("version").notNull().default("1.0.0"),
  capabilities: jsonb("capabilities").notNull().default([]),
  description: text("description"),
  model: text("model").notNull().default("gpt-4o-mini"),
  status: text("status").notNull().default("active"),
  reputationScore: real("reputation_score").notNull().default(100),
  totalExecutions: integer("total_executions").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  successRate: real("success_rate").notNull().default(100),
  avgCompletionMs: integer("avg_completion_ms").notNull().default(0),
  qualityScore: real("quality_score").notNull().default(100),
  humanFeedbackScore: real("human_feedback_score").notNull().default(100),
  tags: jsonb("tags").notNull().default([]),
  endpoint: text("endpoint"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAgentRegistrySchema = createInsertSchema(agentRegistryTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAgentRegistry = z.infer<typeof insertAgentRegistrySchema>;
export type AgentRegistry = typeof agentRegistryTable.$inferSelect;
