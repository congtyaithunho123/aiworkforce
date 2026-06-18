import { pgTable, serial, text, integer, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./sales-companies";

export const campaignsTable = pgTable("sales_campaigns", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"),
  workflowStep: text("workflow_step").notNull().default("research"),
  totalLeads: integer("total_leads").notNull().default(0),
  totalEmails: integer("total_emails").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  estimatedCost: real("estimated_cost").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({
  id: true,
  status: true,
  workflowStep: true,
  totalLeads: true,
  totalEmails: true,
  totalTokens: true,
  estimatedCost: true,
  createdAt: true,
  updatedAt: true,
});

export type Campaign = typeof campaignsTable.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
