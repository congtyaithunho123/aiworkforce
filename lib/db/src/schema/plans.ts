import { pgTable, serial, text, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // starter, growth, enterprise
  displayName: text("display_name").notNull(),
  description: text("description"),
  priceMonthly: numeric("price_monthly", { precision: 10, scale: 2 }).notNull().default("0"),
  priceYearly: numeric("price_yearly", { precision: 10, scale: 2 }).notNull().default("0"),
  maxAgents: integer("max_agents").notNull().default(5),
  maxWorkflows: integer("max_workflows").notNull().default(10),
  maxTasksPerMonth: integer("max_tasks_per_month").notNull().default(500),
  maxTokensPerMonth: integer("max_tokens_per_month").notNull().default(1000000),
  maxTeamMembers: integer("max_team_members").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true, createdAt: true });
export type Plan = typeof plansTable.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;
