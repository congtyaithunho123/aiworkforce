import { pgTable, serial, text, integer, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { kernelAgentsTable } from "./os-kernel";

export const resourceQuotasTable = pgTable("resource_quotas", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  agentId: integer("agent_id").references(() => kernelAgentsTable.id, { onDelete: "cascade" }),
  scope: text("scope").notNull().default("agent"),
  cpuLimitMs: integer("cpu_limit_ms").notNull().default(60000),
  ramLimitMb: integer("ram_limit_mb").notNull().default(512),
  tokenLimit: integer("token_limit").notNull().default(100000),
  costLimitUsd: real("cost_limit_usd").notNull().default(10.0),
  requestsPerHour: integer("requests_per_hour").notNull().default(1000),
  currentCpuMs: integer("current_cpu_ms").notNull().default(0),
  currentRamMb: integer("current_ram_mb").notNull().default(0),
  currentTokens: integer("current_tokens").notNull().default(0),
  currentCostUsd: real("current_cost_usd").notNull().default(0),
  currentRequests: integer("current_requests").notNull().default(0),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull().defaultNow(),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const resourceUsageTable = pgTable("resource_usage", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  agentId: integer("agent_id").references(() => kernelAgentsTable.id),
  agentName: text("agent_name"),
  cpuMs: integer("cpu_ms").notNull().default(0),
  ramMb: integer("ram_mb").notNull().default(0),
  tokensUsed: integer("tokens_used").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  requestCount: integer("request_count").notNull().default(1),
  operation: text("operation"),
  metadata: jsonb("metadata").notNull().default({}),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertResourceQuotaSchema = createInsertSchema(resourceQuotasTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertResourceUsageSchema = createInsertSchema(resourceUsageTable).omit({ id: true, recordedAt: true });

export type ResourceQuota = typeof resourceQuotasTable.$inferSelect;
export type InsertResourceQuota = z.infer<typeof insertResourceQuotaSchema>;
export type ResourceUsage = typeof resourceUsageTable.$inferSelect;
export type InsertResourceUsage = z.infer<typeof insertResourceUsageSchema>;
