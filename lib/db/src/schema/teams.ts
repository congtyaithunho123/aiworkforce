import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { departmentsTable } from "./departments";
import { agentsTable } from "./agents";

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  departmentId: integer("department_id")
    .references(() => departmentsTable.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  leadAgentId: integer("lead_agent_id")
    .references(() => agentsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamAgentsTable = pgTable("team_agents", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id")
    .references(() => teamsTable.id, { onDelete: "cascade" })
    .notNull(),
  agentId: integer("agent_id")
    .references(() => agentsTable.id, { onDelete: "cascade" })
    .notNull(),
  role: text("role").notNull().default("member"),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTeamSchema = createInsertSchema(teamsTable).omit({
  id: true,
  createdAt: true,
});

export const insertTeamAgentSchema = createInsertSchema(teamAgentsTable).omit({
  id: true,
  assignedAt: true,
});

export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;
export type InsertTeamAgent = z.infer<typeof insertTeamAgentSchema>;
export type TeamAgent = typeof teamAgentsTable.$inferSelect;
