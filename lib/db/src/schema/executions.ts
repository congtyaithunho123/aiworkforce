import { pgTable, serial, text, integer, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { agentsTable } from "./agents";
import { tasksTable } from "./tasks";

export const executionsTable = pgTable("executions", {
  id: serial("id").primaryKey(),
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
  status: text("status").notNull().default("running"),
  output: text("output"),
});

export const insertExecutionSchema = createInsertSchema(executionsTable).omit({
  id: true,
  startedAt: true,
});

export type InsertExecution = z.infer<typeof insertExecutionSchema>;
export type Execution = typeof executionsTable.$inferSelect;
