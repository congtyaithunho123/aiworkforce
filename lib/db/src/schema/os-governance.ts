import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const osAuditLogsTable = pgTable("os_audit_logs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  actor: text("actor").notNull(),
  actorType: text("actor_type").notNull().default("user"),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  severity: text("severity").notNull().default("info"),
  status: text("status").notNull().default("success"),
  before: jsonb("before"),
  after: jsonb("after"),
  metadata: jsonb("metadata").notNull().default({}),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const approvalsTable = pgTable("os_approvals", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  requestType: text("request_type").notNull(),
  requestedBy: text("requested_by").notNull(),
  approvedBy: text("approved_by"),
  status: text("status").notNull().default("pending"),
  priority: text("priority").notNull().default("medium"),
  payload: jsonb("payload").notNull().default({}),
  rejectionReason: text("rejection_reason"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOsAuditLogSchema = createInsertSchema(osAuditLogsTable).omit({ id: true, createdAt: true });
export const insertApprovalSchema = createInsertSchema(approvalsTable).omit({ id: true, createdAt: true });

export type OsAuditLog = typeof osAuditLogsTable.$inferSelect;
export type InsertOsAuditLog = z.infer<typeof insertOsAuditLogSchema>;
export type Approval = typeof approvalsTable.$inferSelect;
export type InsertApproval = z.infer<typeof insertApprovalSchema>;
