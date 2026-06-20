import { pgTable, serial, text, integer, timestamp, jsonb, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const benchmarkRunsTable = pgTable("benchmark_runs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  config: jsonb("config").notNull().default({}),
  summary: jsonb("summary").notNull().default({}),
  readinessScore: real("readiness_score"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const benchmarkResultsTable = pgTable("benchmark_results", {
  id: serial("id").primaryKey(),
  runId: integer("run_id")
    .references(() => benchmarkRunsTable.id, { onDelete: "cascade" })
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  testName: text("test_name").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("pass"),
  score: real("score"),
  metrics: jsonb("metrics").notNull().default({}),
  details: jsonb("details").notNull().default({}),
  passed: boolean("passed").notNull().default(true),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBenchmarkRunSchema = createInsertSchema(benchmarkRunsTable).omit({ id: true, createdAt: true });
export const insertBenchmarkResultSchema = createInsertSchema(benchmarkResultsTable).omit({ id: true, createdAt: true });

export type BenchmarkRun = typeof benchmarkRunsTable.$inferSelect;
export type BenchmarkResult = typeof benchmarkResultsTable.$inferSelect;
