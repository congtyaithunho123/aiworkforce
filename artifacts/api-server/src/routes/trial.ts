import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, organizationsTable } from "@workspace/db";

const router = Router();

// GET /trial/status
router.get("/trial/status", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId));

  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  const now = new Date();
  const trialEndsAt = org.trialEndsAt;

  let daysRemaining = 0;
  let isTrialing = false;
  let isExpired = false;

  if (trialEndsAt) {
    const msRemaining = trialEndsAt.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
    isTrialing = msRemaining > 0;
    isExpired = msRemaining <= 0;
  }

  res.json({
    trialEndsAt,
    daysRemaining,
    isTrialing,
    isExpired,
    freeTasksRemaining: org.freeTasksRemaining,
    showWarning: isTrialing && daysRemaining <= 3,
  });
});

export default router;
