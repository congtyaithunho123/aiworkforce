import { pgTable, serial, text, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const kernelAgentsTable = pgTable("kernel_agents", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  agentType: text("agent_type").notNull().default("generic"),
  status: text("status").notNull().default("CREATED"),
  workerNode: text("worker_node"),
  priority: integer("priority").notNull().default(5),
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
  capabilities: jsonb("capabilities").notNull().default([]),
  config: jsonb("config").notNull().default({}),
  lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  pausedAt: timestamp("paused_at", { withTimezone: true }),
  terminatedAt: timestamp("terminated_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kernelWorkflowsTable = pgTable("kernel_workflows", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("idle"),
  scheduleType: text("schedule_type").notNull().default("immediate"),
  cronExpression: text("cron_expression"),
  eventTrigger: text("event_trigger"),
  steps: jsonb("steps").notNull().default([]),
  config: jsonb("config").notNull().default({}),
  isEnabled: boolean("is_enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  runCount: integer("run_count").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kernelTasksTable = pgTable("kernel_tasks", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  workflowId: integer("workflow_id").references(() => kernelWorkflowsTable.id),
  agentId: integer("agent_id").references(() => kernelAgentsTable.id),
  name: text("name").notNull(),
  type: text("type").notNull().default("generic"),
  status: text("status").notNull().default("queued"),
  priority: integer("priority").notNull().default(5),
  input: jsonb("input").notNull().default({}),
  output: jsonb("output"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
  durationMs: integer("duration_ms"),
  queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertKernelAgentSchema = createInsertSchema(kernelAgentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertKernelWorkflowSchema = createInsertSchema(kernelWorkflowsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertKernelTaskSchema = createInsertSchema(kernelTasksTable).omit({ id: true, createdAt: true });

export type KernelAgent = typeof kernelAgentsTable.$inferSelect;
export type InsertKernelAgent = z.infer<typeof insertKernelAgentSchema>;
export type KernelWorkflow = typeof kernelWorkflowsTable.$inferSelect;
export type InsertKernelWorkflow = z.infer<typeof insertKernelWorkflowSchema>;
export type KernelTask = typeof kernelTasksTable.$inferSelect;
export type InsertKernelTask = z.infer<typeof insertKernelTaskSchema>;
