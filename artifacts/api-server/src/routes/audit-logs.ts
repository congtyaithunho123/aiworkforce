import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod/v4";
import { db, auditLogsTable } from "@workspace/db";
import { requireRole } from "../middleware/require-role";

const router = Router();

// GET /audit-logs — Owner/Admin only
router.get("/audit-logs", requireRole(["owner", "admin"]), async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  const logs = await db
    .select()
    .from(auditLogsTable)
    .where(eq(auditLogsTable.organizationId, orgId))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(logs);
});

// POST /audit-logs — internal helper (also exported as a function)
export async function createAuditLog(data: {
  organizationId: number;
  userId?: number;
  actorType?: string;
  action: string;
  resource?: string;
  resourceId?: number;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  try {
    await db.insert(auditLogsTable).values({
      organizationId: data.organizationId,
      userId: data.userId,
      actorType: data.actorType ?? "user",
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId,
      details: data.details,
      ipAddress: data.ipAddress,
    });
  } catch {
    // Never throw — audit log must not break main flows
  }
}

export default router;
