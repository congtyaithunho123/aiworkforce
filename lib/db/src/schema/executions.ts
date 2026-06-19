import { pgTable, serial, text, integer, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { agentsTable } from "./agents";
import { tasksTable } from "./tasks";
import { organizationsTable } from "./organizations";

export const executionsTable = pgTable("executions", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  taskId: integer("task_id")
    .references(() => tasksTable.id, { onDelete: "cascade" })
    .notNull(),
  agentId: integer("agent_id")
    .references(() => agentsTable.id, { onDelete: "cascade" })
    .notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  estimatedCost: real("estimated_cost").notNull().default(0),
  durationMs: integer("duration_ms"),
  status: text("status").notNull().default("running"), // running, completed, failed
  output: text("output"),
  errorMessage: text("error_message"),
  // Agent Evaluation scores (0–100), set by Evaluator Agent after completion
  qualityScore: integer("quality_score"),
  accuracyScore: integer("accuracy_score"),
  completenessScore: integer("completeness_score"),
  evaluationNote: text("evaluation_note"),
});

export const insertExecutionSchema = createInsertSchema(executionsTable).omit({
  id: true,
  startedAt: true,
});

export type InsertExecution = z.infer<typeof insertExecutionSchema>;
export type Execution = typeof executionsTable.$inferSelect;
