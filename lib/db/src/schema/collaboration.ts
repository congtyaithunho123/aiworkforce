import { pgTable, serial, text, integer, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const collaborationSessionsTable = pgTable("collaboration_sessions", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  originalTask: text("original_task").notNull(),
  status: text("status").notNull().default("pending"),
  totalSubtasks: integer("total_subtasks").notNull().default(0),
  completedSubtasks: integer("completed_subtasks").notNull().default(0),
  failedSubtasks: integer("failed_subtasks").notNull().default(0),
  aggregatedResult: text("aggregated_result"),
  progressPct: real("progress_pct").notNull().default(0),
  correlationId: text("correlation_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const collaborationSubtasksTable = pgTable("collaboration_subtasks", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .references(() => collaborationSessionsTable.id, { onDelete: "cascade" })
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  subtask: text("subtask").notNull(),
  capability: text("capability").notNull(),
  assignedAgentId: integer("assigned_agent_id"),
  assignedAgentName: text("assigned_agent_name"),
  messageId: integer("message_id"),
  status: text("status").notNull().default("pending"),
  result: text("result"),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
  metadata: jsonb("metadata").notNull().default({}),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCollaborationSessionSchema = createInsertSchema(collaborationSessionsTable).omit({
  id: true,
  createdAt: true,
});
export const insertCollaborationSubtaskSchema = createInsertSchema(collaborationSubtasksTable).omit({
  id: true,
  createdAt: true,
});

export type InsertCollaborationSession = z.infer<typeof insertCollaborationSessionSchema>;
export type CollaborationSession = typeof collaborationSessionsTable.$inferSelect;
export type InsertCollaborationSubtask = z.infer<typeof insertCollaborationSubtaskSchema>;
export type CollaborationSubtask = typeof collaborationSubtasksTable.$inferSelect;
