import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { organizationsTable } from "./organizations";

export const dealsTable = pgTable("deals", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  customerId: integer("customer_id")
    .references(() => customersTable.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  stage: text("stage").notNull().default("lead"), // lead, demo, trial, paid
  value: real("value").notNull().default(0), // USD/month
  currency: text("currency").notNull().default("USD"),
  notes: text("notes"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDealSchema = createInsertSchema(dealsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type Deal = typeof dealsTable.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;
