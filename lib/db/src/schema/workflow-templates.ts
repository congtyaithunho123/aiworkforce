import { pgTable, serial, text, boolean, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export interface WorkflowTemplateStep {
  name: string;
  agentRole: string;
  prompt: string;
  outputFormat: "text" | "json";
}

export const workflowTemplatesTable = pgTable("workflow_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().default("general"),
  steps: jsonb("steps").$type<WorkflowTemplateStep[]>().notNull().default([]),
  estimatedMinutes: integer("estimated_minutes").notNull().default(5),
  tags: jsonb("tags").$type<string[]>().default([]),
  isPublic: boolean("is_public").notNull().default(true),
  useCount: integer("use_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWorkflowTemplateSchema = createInsertSchema(workflowTemplatesTable).omit({ id: true, createdAt: true });
export type WorkflowTemplate = typeof workflowTemplatesTable.$inferSelect;
export type InsertWorkflowTemplate = z.infer<typeof insertWorkflowTemplateSchema>;
