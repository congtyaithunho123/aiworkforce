import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { db, notificationsTable } from "@workspace/db";

const router = Router();

// GET /notifications
router.get("/notifications", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const userId = req.user!.userId;
  const limit = Math.min(Number(req.query.limit) || 30, 100);

  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(and(
      eq(notificationsTable.organizationId, orgId),
    ))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit);

  const unreadCount = notifications.filter(n => !n.isRead && (n.userId === null || n.userId === userId)).length;
  res.json({ notifications, unreadCount });
});

// PATCH /notifications/:id/read
router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const id = parseInt(req.params.id);

  await db.update(notificationsTable)
    .set({ isRead: true })
    .where(and(
      eq(notificationsTable.id, id),
      eq(notificationsTable.organizationId, orgId),
    ));
  res.json({ success: true });
});

// PATCH /notifications/read-all
router.patch("/notifications/read-all", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  await db.update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.organizationId, orgId));
  res.json({ success: true });
});

// POST /notifications — internal use
export async function createNotification(data: {
  organizationId: number;
  userId?: number;
  type: string;
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: number;
}) {
  try {
    await db.insert(notificationsTable).values(data);
  } catch {
    // Never throw — notifications must not break main flows
  }
}

export default router;
