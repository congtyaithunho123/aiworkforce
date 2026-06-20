import { pgTable, serial, text, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const osDeploymentsTable = pgTable("os_deployments", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  environment: text("environment").notNull().default("production"),
  target: text("target").notNull().default("local"),
  status: text("status").notNull().default("pending"),
  version: text("version").notNull().default("1.0.0"),
  config: jsonb("config").notNull().default({}),
  replicas: integer("replicas").notNull().default(1),
  healthCheckUrl: text("health_check_url"),
  isHealthy: boolean("is_healthy"),
  deployedBy: text("deployed_by"),
  deployLog: jsonb("deploy_log").notNull().default([]),
  rollbackVersion: text("rollback_version"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOsDeploymentSchema = createInsertSchema(osDeploymentsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type OsDeployment = typeof osDeploymentsTable.$inferSelect;
export type InsertOsDeployment = z.infer<typeof insertOsDeploymentSchema>;
