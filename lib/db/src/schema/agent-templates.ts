import { pgTable, serial, text, boolean, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentTemplatesTable = pgTable("agent_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().default("general"),
  systemPrompt: text("system_prompt").notNull(),
  model: text("model").notNull().default("gpt-4o-mini"),
  outputFormat: text("output_format").notNull().default("text"),
  outputSchema: text("output_schema"),
  tags: jsonb("tags").$type<string[]>().default([]),
  isPublic: boolean("is_public").notNull().default(true),
  useCount: integer("use_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAgentTemplateSchema = createInsertSchema(agentTemplatesTable).omit({ id: true, createdAt: true });
export type AgentTemplate = typeof agentTemplatesTable.$inferSelect;
export type InsertAgentTemplate = z.infer<typeof insertAgentTemplateSchema>;
