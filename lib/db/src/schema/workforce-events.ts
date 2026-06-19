import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const workforceEventsTable = pgTable("workforce_events", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull().default("info"),
  sourceType: text("source_type").notNull().default("system"),
  sourceId: integer("source_id"),
  payload: jsonb("payload").notNull().default({}),
  message: text("message"),
  correlationId: text("correlation_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWorkforceEventSchema = createInsertSchema(workforceEventsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertWorkforceEvent = z.infer<typeof insertWorkforceEventSchema>;
export type WorkforceEvent = typeof workforceEventsTable.$inferSelect;

export const WORKFORCE_EVENT_TYPES = [
  "TASK_CREATED",
  "TASK_COMPLETED",
  "TASK_FAILED",
  "WORKFLOW_STARTED",
  "WORKFLOW_COMPLETED",
  "WORKFLOW_FAILED",
  "AGENT_REGISTERED",
  "AGENT_UPDATED",
  "AGENT_DEACTIVATED",
  "MESSAGE_SENT",
  "MESSAGE_DELIVERED",
  "MEMORY_WRITTEN",
  "MEMORY_READ",
  "CAPABILITY_ROUTED",
  "FEDERATION_LINKED",
  "FEDERATION_REQUEST",
] as const;

export type WorkforceEventType = (typeof WORKFORCE_EVENT_TYPES)[number];
