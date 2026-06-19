import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, referralsTable, usersTable, organizationsTable } from "@workspace/db";

const router = Router();

function generateReferralCode(userId: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const base = userId.toString(36).toUpperCase().padStart(3, "0");
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${base}${suffix}`;
}

// GET /referral/my-code — auto-create code if not exists
router.get("/referral/my-code", async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  let [referral] = await db
    .select()
    .from(referralsTable)
    .where(eq(referralsTable.userId, userId));

  if (!referral) {
    let code = generateReferralCode(userId);
    // Retry if collision
    const [existing] = await db.select().from(referralsTable).where(eq(referralsTable.code, code));
    if (existing) {
      code = generateReferralCode(userId) + Math.floor(Math.random() * 100);
    }

    [referral] = await db.insert(referralsTable).values({ userId, code }).returning();
  }

  const referredUserIds: number[] = JSON.parse(referral.referredUserIds);
  const appUrl = process.env.APP_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost:5173"}`;

  res.json({
    code: referral.code,
    referralLink: `${appUrl}/register?ref=${referral.code}`,
    referredCount: referredUserIds.length,
    trialDaysAdded: referral.trialDaysAdded,
    createdAt: referral.createdAt,
  });
});

// GET /referral/stats — stats for the referral page
router.get("/referral/stats", async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const [referral] = await db
    .select()
    .from(referralsTable)
    .where(eq(referralsTable.userId, userId));

  if (!referral) {
    const appUrl = process.env.APP_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost:5173"}`;
    res.json({
      code: null,
      referralLink: null,
      referredCount: 0,
      trialDaysAdded: 0,
    });
    return;
  }

  const referredUserIds: number[] = JSON.parse(referral.referredUserIds);
  const appUrl = process.env.APP_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost:5173"}`;

  res.json({
    code: referral.code,
    referralLink: `${appUrl}/register?ref=${referral.code}`,
    referredCount: referredUserIds.length,
    trialDaysAdded: referral.trialDaysAdded,
    createdAt: referral.createdAt,
  });
});

// POST /referral/claim — called after a user registers via a ref code
// Body: { referralCode }
const ClaimBody = z.object({ referralCode: z.string().min(1) });

router.post("/referral/claim", async (req, res): Promise<void> => {
  const parsed = ClaimBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const newUserId = req.user!.userId;
  const newUserOrgId = req.user!.organizationId;

  // Find the referral record
  const [referral] = await db
    .select()
    .from(referralsTable)
    .where(eq(referralsTable.code, parsed.data.referralCode.toUpperCase()));

  if (!referral) {
    res.status(404).json({ error: "Referral code not found" });
    return;
  }

  if (referral.userId === newUserId) {
    res.status(400).json({ error: "Cannot use your own referral code" });
    return;
  }

  // Check if already claimed
  const referredUserIds: number[] = JSON.parse(referral.referredUserIds);
  if (referredUserIds.includes(newUserId)) {
    res.status(409).json({ error: "Referral already claimed" });
    return;
  }

  // Add 7 days to both: referrer's org and new user's org
  const BONUS_DAYS = 7;

  // Get referrer's org
  const [referrerUser] = await db.select().from(usersTable).where(eq(usersTable.id, referral.userId));

  if (referrerUser) {
    const [referrerOrg] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, referrerUser.organizationId));

    if (referrerOrg) {
      const currentEnd = referrerOrg.trialEndsAt ?? new Date();
      const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()) + BONUS_DAYS * 24 * 60 * 60 * 1000);
      await db
        .update(organizationsTable)
        .set({ trialEndsAt: newEnd })
        .where(eq(organizationsTable.id, referrerOrg.id));
    }
  }

  // Add 7 days to new user's org
  const [newOrg] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, newUserOrgId));

  if (newOrg) {
    const currentEnd = newOrg.trialEndsAt ?? new Date();
    const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()) + BONUS_DAYS * 24 * 60 * 60 * 1000);
    await db
      .update(organizationsTable)
      .set({ trialEndsAt: newEnd })
      .where(eq(organizationsTable.id, newOrg.id));
  }

  // Update referral record
  referredUserIds.push(newUserId);
  await db
    .update(referralsTable)
    .set({
      referredUserIds: JSON.stringify(referredUserIds),
      trialDaysAdded: referral.trialDaysAdded + BONUS_DAYS,
    })
    .where(eq(referralsTable.id, referral.id));

  res.json({ success: true, bonusDays: BONUS_DAYS });
});

export default router;
