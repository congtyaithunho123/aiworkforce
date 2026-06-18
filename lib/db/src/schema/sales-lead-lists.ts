import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campaignsTable } from "./sales-campaigns";
import { contactsTable } from "./sales-contacts";
import { organizationsTable } from "./organizations";

export const leadListsTable = pgTable("sales_lead_lists", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  campaignId: integer("campaign_id").references(() => campaignsTable.id, { onDelete: "cascade" }).notNull(),
  contactId: integer("contact_id").references(() => contactsTable.id, { onDelete: "cascade" }).notNull(),
  emailSubject: text("email_subject"),
  emailBody: text("email_body"),
  followup2: text("followup2"),
  followup3: text("followup3"),
  followup4: text("followup4"),
  emailStatus: text("email_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLeadListSchema = createInsertSchema(leadListsTable).omit({
  id: true,
  emailStatus: true,
  createdAt: true,
  updatedAt: true,
});

export type LeadList = typeof leadListsTable.$inferSelect;
export type InsertLeadList = z.infer<typeof insertLeadListSchema>;
