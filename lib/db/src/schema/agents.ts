import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const agentsTable = pgTable("agents", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  model: text("model").notNull().default("gpt-4o-mini"),
  outputFormat: text("output_format").notNull().default("text"),
  outputSchema: text("output_schema"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAgentSchema = createInsertSchema(agentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agentsTable.$inferSelect;
