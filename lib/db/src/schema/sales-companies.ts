import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companiesTable = pgTable("sales_companies", {
  id: serial("id").primaryKey(),
  website: text("website").notNull(),
  name: text("name"),
  productDescription: text("product_description"),
  industry: text("industry"),
  icp: text("icp"),
  painPoints: jsonb("pain_points").$type<string[]>().default([]),
  competitors: jsonb("competitors").$type<string[]>().default([]),
  researchStatus: text("research_status").notNull().default("pending"),
  rawResearch: text("raw_research"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({
  id: true,
  researchStatus: true,
  rawResearch: true,
  createdAt: true,
  updatedAt: true,
});

export type Company = typeof companiesTable.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
