import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { agentsTable } from "./agents";
import { organizationsTable } from "./organizations";

export const agentMessagesTable = pgTable("agent_messages", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  fromAgentId: integer("from_agent_id")
    .references(() => agentsTable.id, { onDelete: "set null" }),
  toAgentId: integer("to_agent_id")
    .references(() => agentsTable.id, { onDelete: "set null" }),
  messageType: text("message_type").notNull().default("task"),
  payload: jsonb("payload").notNull().default({}),
  status: text("status").notNull().default("pending"),
  replyToId: integer("reply_to_id"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAgentMessageSchema = createInsertSchema(agentMessagesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertAgentMessage = z.infer<typeof insertAgentMessageSchema>;
export type AgentMessage = typeof agentMessagesTable.$inferSelect;
