import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workflowsTable } from "./workflows";
import { agentsTable } from "./agents";

export const workflowStepsTable = pgTable("workflow_steps", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id")
    .references(() => workflowsTable.id, { onDelete: "cascade" })
    .notNull(),
  order: integer("order").notNull(),
  agentId: integer("agent_id")
    .references(() => agentsTable.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  instruction: text("instruction").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWorkflowStepSchema = createInsertSchema(workflowStepsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertWorkflowStep = z.infer<typeof insertWorkflowStepSchema>;
export type WorkflowStep = typeof workflowStepsTable.$inferSelect;
