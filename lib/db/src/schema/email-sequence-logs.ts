import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const emailSequenceLogsTable = pgTable("email_sequence_logs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sequenceDay: text("sequence_day").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("pending"),
  scheduledAt: timestamp("scheduled_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
