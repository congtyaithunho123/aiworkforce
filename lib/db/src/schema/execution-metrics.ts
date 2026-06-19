import { pgTable, serial, integer, real, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const executionMetricsTable = pgTable("execution_metrics", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  periodDate: text("period_date").notNull(), // YYYY-MM-DD
  totalExecutions: integer("total_executions").notNull().default(0),
  successfulExecutions: integer("successful_executions").notNull().default(0),
  failedExecutions: integer("failed_executions").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  totalCost: real("total_cost").notNull().default(0),
  avgDurationMs: integer("avg_duration_ms").notNull().default(0),
  p50LatencyMs: integer("p50_latency_ms"),
  p95LatencyMs: integer("p95_latency_ms"),
  avgQualityScore: real("avg_quality_score"),
  successRate: real("success_rate").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertExecutionMetricsSchema = createInsertSchema(executionMetricsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type ExecutionMetrics = typeof executionMetricsTable.$inferSelect;
export type InsertExecutionMetrics = z.infer<typeof insertExecutionMetricsSchema>;
