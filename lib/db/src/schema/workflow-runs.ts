import { pgTable, serial, text, integer, timestamp, real } from "drizzle-orm/pg-core";
import { workflowsTable } from "./workflows";
import { workflowStepsTable } from "./workflow-steps";
import { agentsTable } from "./agents";
import { organizationsTable } from "./organizations";

export const workflowRunsTable = pgTable("workflow_runs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  workflowId: integer("workflow_id")
    .references(() => workflowsTable.id, { onDelete: "cascade" })
    .notNull(),
  status: text("status").notNull().default("running"),
  input: text("input").notNull(),
  finalOutput: text("final_output"),
  errorMessage: text("error_message"),
  totalTokens: integer("total_tokens").notNull().default(0),
  totalCost: real("total_cost").notNull().default(0),
  durationMs: integer("duration_ms"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const workflowStepLogsTable = pgTable("workflow_step_logs", {
  id: serial("id").primaryKey(),
  workflowRunId: integer("workflow_run_id")
    .references(() => workflowRunsTable.id, { onDelete: "cascade" })
    .notNull(),
  workflowStepId: integer("workflow_step_id")
    .references(() => workflowStepsTable.id, { onDelete: "cascade" })
    .notNull(),
  agentId: integer("agent_id")
    .references(() => agentsTable.id, { onDelete: "cascade" })
    .notNull(),
  stepOrder: integer("step_order").notNull(),
  stepName: text("step_name").notNull(),
  status: text("status").notNull().default("running"),
  input: text("input").notNull(),
  output: text("output"),
  errorMessage: text("error_message"),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  estimatedCost: real("estimated_cost").notNull().default(0),
  durationMs: integer("duration_ms"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type WorkflowRun = typeof workflowRunsTable.$inferSelect;
export type WorkflowStepLog = typeof workflowStepLogsTable.$inferSelect;
