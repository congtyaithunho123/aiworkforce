import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { marketingProjectsTable } from "./marketing-projects";

export const marketingKeywordsTable = pgTable("marketing_keywords", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => marketingProjectsTable.id, { onDelete: "cascade" }).notNull().unique(),
  primaryKeyword: text("primary_keyword"),
  secondaryKeywords: jsonb("secondary_keywords").$type<string[]>().default([]),
  lsiKeywords: jsonb("lsi_keywords").$type<string[]>().default([]),
  suggestedTitle: text("suggested_title"),
  metaDescription: text("meta_description"),
  keywordData: jsonb("keyword_data").$type<Array<{ keyword: string; intent: string; difficulty: string; volume: string }>>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMarketingKeywordsSchema = createInsertSchema(marketingKeywordsTable).omit({
  id: true, createdAt: true,
});

export type MarketingKeywords = typeof marketingKeywordsTable.$inferSelect;
export type InsertMarketingKeywords = z.infer<typeof insertMarketingKeywordsSchema>;
