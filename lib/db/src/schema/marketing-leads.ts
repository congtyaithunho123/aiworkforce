import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const marketingLeadsTable = pgTable("marketing_leads", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  company: text("company"),
  phone: text("phone"),
  message: text("message"),
  source: text("source").notNull().default("contact_form"),
  websiteAnalyzed: text("website_analyzed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMarketingLeadSchema = createInsertSchema(marketingLeadsTable).omit({
  id: true,
  createdAt: true,
});

export type MarketingLead = typeof marketingLeadsTable.$inferSelect;
export type InsertMarketingLead = z.infer<typeof insertMarketingLeadSchema>;
