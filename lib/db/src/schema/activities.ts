import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { dealsTable } from "./deals";
import { organizationsTable } from "./organizations";

export const activitiesTable = pgTable("activities", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  dealId: integer("deal_id")
    .references(() => dealsTable.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull().default("note"), // note, call, email, meeting, stage_change
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activitiesTable).omit({ id: true, createdAt: true });
export type Activity = typeof activitiesTable.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
