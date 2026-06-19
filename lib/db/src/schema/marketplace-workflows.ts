import { pgTable, serial, integer, text, boolean, timestamp, jsonb, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const marketplaceWorkflowsTable = pgTable("marketplace_workflows", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  creatorId: integer("creator_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  description: text("description").notNull().default(""),
  longDescription: text("long_description").notNull().default(""),
  category: text("category").notNull().default("general"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  steps: jsonb("steps").$type<{ name: string; agentRole: string; description?: string }[]>().notNull().default([]),
  estimatedMinutes: integer("estimated_minutes").notNull().default(5),
  version: text("version").notNull().default("1.0.0"),
  status: text("status").notNull().default("draft"),
  isFeatured: boolean("is_featured").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  iconEmoji: text("icon_emoji").notNull().default("⚡"),
  priceType: text("price_type").notNull().default("free"),
  priceCents: integer("price_cents").notNull().default(0),
  installCount: integer("install_count").notNull().default(0),
  activeInstalls: integer("active_installs").notNull().default(0),
  executionCount: integer("execution_count").notNull().default(0),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }).notNull().default("100.00"),
  avgTokenCost: integer("avg_token_cost").notNull().default(0),
  revenueSharePct: integer("revenue_share_pct").notNull().default(70),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMarketplaceWorkflowSchema = createInsertSchema(marketplaceWorkflowsTable).omit({
  id: true, createdAt: true, updatedAt: true,
  installCount: true, activeInstalls: true, executionCount: true,
});
export type MarketplaceWorkflow = typeof marketplaceWorkflowsTable.$inferSelect;
export type InsertMarketplaceWorkflow = z.infer<typeof insertMarketplaceWorkflowSchema>;
