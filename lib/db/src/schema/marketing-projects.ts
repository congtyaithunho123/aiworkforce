import { pgTable, serial, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const marketingProjectsTable = pgTable("marketing_projects", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  topic: text("topic").notNull(),
  targetAudience: text("target_audience"),
  niche: text("niche"),
  workflowStep: text("workflow_step").notNull().default("research"),
  status: text("status").notNull().default("draft"),
  totalTokens: integer("total_tokens").notNull().default(0),
  estimatedCost: real("estimated_cost").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMarketingProjectSchema = createInsertSchema(marketingProjectsTable).omit({
  id: true,
  workflowStep: true,
  status: true,
  totalTokens: true,
  estimatedCost: true,
  createdAt: true,
  updatedAt: true,
});

export type MarketingProject = typeof marketingProjectsTable.$inferSelect;
export type InsertMarketingProject = z.infer<typeof insertMarketingProjectSchema>;
