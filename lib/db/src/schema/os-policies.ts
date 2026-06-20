import { pgTable, serial, text, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { kernelAgentsTable } from "./os-kernel";

export const policiesTable = pgTable("os_policies", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  role: text("role").notNull(),
  effect: text("effect").notNull().default("allow"),
  resources: jsonb("resources").notNull().default([]),
  actions: jsonb("actions").notNull().default([]),
  conditions: jsonb("conditions").notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  priority: integer("priority").notNull().default(10),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sandboxSessionsTable = pgTable("sandbox_sessions", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  agentId: integer("agent_id").references(() => kernelAgentsTable.id),
  agentName: text("agent_name"),
  status: text("status").notNull().default("initializing"),
  allowedTools: jsonb("allowed_tools").notNull().default([]),
  allowedResources: jsonb("allowed_resources").notNull().default([]),
  networkAccess: boolean("network_access").notNull().default(false),
  memoryAccess: boolean("memory_access").notNull().default(true),
  memoryNamespace: text("memory_namespace"),
  envVars: jsonb("env_vars").notNull().default({}),
  executionLog: jsonb("execution_log").notNull().default([]),
  startedAt: timestamp("started_at", { withTimezone: true }),
  terminatedAt: timestamp("terminated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPolicySchema = createInsertSchema(policiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSandboxSessionSchema = createInsertSchema(sandboxSessionsTable).omit({ id: true, createdAt: true });

export type Policy = typeof policiesTable.$inferSelect;
export type InsertPolicy = z.infer<typeof insertPolicySchema>;
export type SandboxSession = typeof sandboxSessionsTable.$inferSelect;
export type InsertSandboxSession = z.infer<typeof insertSandboxSessionSchema>;
