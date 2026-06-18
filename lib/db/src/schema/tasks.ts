import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { agentsTable } from "./agents";
import { organizationsTable } from "./organizations";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agentsTable.id, { onDelete: "cascade" }).notNull(),
  organizationId: integer("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }).notNull(),
  input: text("input").notNull(),
  status: text("status").notNull().default("pending"),
  result: text("result"),
  errorMessage: text("error_message"),
  executionMs: integer("execution_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  status: true,
  result: true,
  errorMessage: true,
  executionMs: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
