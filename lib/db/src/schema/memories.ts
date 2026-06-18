import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { agentsTable } from "./agents";
import { organizationsTable } from "./organizations";
import { tasksTable } from "./tasks";

export const memoriesTable = pgTable("memories", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agentsTable.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }).notNull(),
  taskId: integer("task_id").references(() => tasksTable.id, { onDelete: "set null" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMemorySchema = createInsertSchema(memoriesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertMemory = z.infer<typeof insertMemorySchema>;
export type Memory = typeof memoriesTable.$inferSelect;
