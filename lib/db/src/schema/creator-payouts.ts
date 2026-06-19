import { pgTable, serial, integer, text, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const creatorPayoutsTable = pgTable("creator_payouts", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id").notNull(),
  targetName: text("target_name").notNull().default(""),
  totalDownloads: integer("total_downloads").notNull().default(0),
  activeInstalls: integer("active_installs").notNull().default(0),
  grossRevenueCents: integer("gross_revenue_cents").notNull().default(0),
  revenueSharePct: integer("revenue_share_pct").notNull().default(70),
  payoutCents: integer("payout_cents").notNull().default(0),
  status: text("status").notNull().default("pending"),
  period: text("period").notNull().default(""),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCreatorPayoutSchema = createInsertSchema(creatorPayoutsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type CreatorPayout = typeof creatorPayoutsTable.$inferSelect;
export type InsertCreatorPayout = z.infer<typeof insertCreatorPayoutSchema>;
