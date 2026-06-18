import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { marketingProjectsTable } from "./marketing-projects";

export const marketingResearchTable = pgTable("marketing_research", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => marketingProjectsTable.id, { onDelete: "cascade" }).notNull().unique(),
  marketTrends: jsonb("market_trends").$type<string[]>().default([]),
  targetPersonas: jsonb("target_personas").$type<string[]>().default([]),
  competitorAngles: jsonb("competitor_angles").$type<string[]>().default([]),
  contentAngles: jsonb("content_angles").$type<string[]>().default([]),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMarketingResearchSchema = createInsertSchema(marketingResearchTable).omit({
  id: true, createdAt: true,
});

export type MarketingResearch = typeof marketingResearchTable.$inferSelect;
export type InsertMarketingResearch = z.infer<typeof insertMarketingResearchSchema>;
