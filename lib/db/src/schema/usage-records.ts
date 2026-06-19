import { pgTable, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const usageRecordsTable = pgTable("usage_records", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  tasksUsed: integer("tasks_used").notNull().default(0),
  workflowsUsed: integer("workflows_used").notNull().default(0),
  tokensUsed: integer("tokens_used").notNull().default(0),
  estimatedCost: numeric("estimated_cost", { precision: 10, scale: 4 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUsageRecordSchema = createInsertSchema(usageRecordsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type UsageRecord = typeof usageRecordsTable.$inferSelect;
export type InsertUsageRecord = z.infer<typeof insertUsageRecordSchema>;
