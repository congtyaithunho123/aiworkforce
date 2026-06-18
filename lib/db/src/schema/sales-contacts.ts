import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./sales-companies";

export const contactsTable = pgTable("sales_contacts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  reason: text("reason"),
  email: text("email"),
  linkedinUrl: text("linkedin_url"),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertContactSchema = createInsertSchema(contactsTable).omit({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export type Contact = typeof contactsTable.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
