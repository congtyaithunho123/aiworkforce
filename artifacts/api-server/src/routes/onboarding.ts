import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, organizationsTable } from "@workspace/db";

const router = Router();

const UpdateOnboardingBody = z.object({
  step: z.number().int().min(0).max(4),
  industry: z.string().optional(),
  website: z.string().optional(),
  aiTeam: z.string().optional(),
  completed: z.boolean().optional(),
});

// GET /onboarding/status
router.get("/onboarding/status", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const [org] = await db
    .select({
      onboardingCompleted: organizationsTable.onboardingCompleted,
      onboardingStep: organizationsTable.onboardingStep,
      industry: organizationsTable.industry,
      website: organizationsTable.website,
      aiTeam: organizationsTable.aiTeam,
    })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId));

  res.json(org ?? { onboardingCompleted: false, onboardingStep: 0 });
});

// PATCH /onboarding/step
router.patch("/onboarding/step", async (req, res): Promise<void> => {
  const parsed = UpdateOnboardingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const orgId = req.user!.organizationId;
  const { step, industry, website, aiTeam, completed } = parsed.data;

  const updates: Partial<typeof organizationsTable.$inferInsert> = {
    onboardingStep: step,
  };
  if (industry !== undefined) updates.industry = industry;
  if (website !== undefined) updates.website = website;
  if (aiTeam !== undefined) updates.aiTeam = aiTeam;
  if (completed !== undefined) updates.onboardingCompleted = completed;

  const [org] = await db
    .update(organizationsTable)
    .set(updates)
    .where(eq(organizationsTable.id, orgId))
    .returning();

  res.json(org);
});

export default router;
