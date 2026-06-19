import { pgTable, serial, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const federationAgreementsTable = pgTable("federation_agreements", {
  id: serial("id").primaryKey(),
  requesterOrganizationId: integer("requester_organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  providerOrganizationId: integer("provider_organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  status: text("status").notNull().default("pending"),
  sharedCapabilities: jsonb("shared_capabilities").notNull().default([]),
  sharedAgentIds: jsonb("shared_agent_ids").notNull().default([]),
  sharedWorkflowIds: jsonb("shared_workflow_ids").notNull().default([]),
  apiKey: text("api_key"),
  isActive: boolean("is_active").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertFederationAgreementSchema = createInsertSchema(federationAgreementsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFederationAgreement = z.infer<typeof insertFederationAgreementSchema>;
export type FederationAgreement = typeof federationAgreementsTable.$inferSelect;
