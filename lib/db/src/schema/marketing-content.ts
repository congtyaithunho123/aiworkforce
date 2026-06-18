import { pgTable, serial, integer, text, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { marketingProjectsTable } from "./marketing-projects";
import { organizationsTable } from "./organizations";

export const marketingContentTable = pgTable("marketing_content", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => marketingProjectsTable.id, { onDelete: "cascade" }).notNull().unique(),
  title: text("title"),
  slug: text("slug"),
  metaDescription: text("meta_description"),
  outline: jsonb("outline").$type<string[]>().default([]),
  body: text("body"),
  wordCount: integer("word_count").default(0),
  seoScore: real("seo_score"),
  seoSuggestions: jsonb("seo_suggestions").$type<string[]>().default([]),
  reviewScore: real("review_score"),
  reviewFeedback: text("review_feedback"),
  reviewStatus: text("review_status").default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMarketingContentSchema = createInsertSchema(marketingContentTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type MarketingContent = typeof marketingContentTable.$inferSelect;
export type InsertMarketingContent = z.infer<typeof insertMarketingContentSchema>;
