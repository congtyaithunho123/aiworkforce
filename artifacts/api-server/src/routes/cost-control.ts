import { Router } from "express";
import { eq, and, gte, sum } from "drizzle-orm";
import { z } from "zod/v4";
import { db, organizationsTable, executionsTable } from "@workspace/db";
import { requireRole } from "../middleware/require-role";

const router = Router();

// GET /cost-control — current org budget settings + spend
router.get("/cost-control", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const [org] = await db.select({
    monthlyBudget: organizationsTable.monthlyBudget,
    budgetWarningThreshold: organizationsTable.budgetWarningThreshold,
    stopOnBudgetExceed: organizationsTable.stopOnBudgetExceed,
  }).from(organizationsTable).where(eq(organizationsTable.id, orgId));

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [usage] = await db.select({ total: sum(executionsTable.estimatedCost) })
    .from(executionsTable)
    .where(and(
      eq(executionsTable.organizationId, orgId),
      gte(executionsTable.startedAt, monthStart),
    ));

  const spentThisMonth = Number(usage?.total ?? 0);
  const budget = org?.monthlyBudget ?? null;
  const percentUsed = budget ? Math.round((spentThisMonth / budget) * 100) : null;

  res.json({
    monthlyBudget: budget,
    budgetWarningThreshold: org?.budgetWarningThreshold ?? 80,
    stopOnBudgetExceed: org?.stopOnBudgetExceed ?? false,
    spentThisMonth: Number(spentThisMonth.toFixed(4)),
    percentUsed,
    status: !budget ? "unlimited" : percentUsed! >= 100 ? "exceeded" : percentUsed! >= (org?.budgetWarningThreshold ?? 80) ? "warning" : "ok",
  });
});

// PATCH /cost-control — update budget settings (owner/admin only)
const UpdateBudgetBody = z.object({
  monthlyBudget: z.number().positive().nullable().optional(),
  budgetWarningThreshold: z.number().int().min(1).max(99).optional(),
  stopOnBudgetExceed: z.boolean().optional(),
});

router.patch("/cost-control", requireRole(["owner", "admin"]), async (req, res): Promise<void> => {
  const parsed = UpdateBudgetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const orgId = req.user!.organizationId;
  const updates: Partial<typeof organizationsTable.$inferInsert> = {};

  if (parsed.data.monthlyBudget !== undefined) updates.monthlyBudget = parsed.data.monthlyBudget;
  if (parsed.data.budgetWarningThreshold !== undefined) updates.budgetWarningThreshold = parsed.data.budgetWarningThreshold;
  if (parsed.data.stopOnBudgetExceed !== undefined) updates.stopOnBudgetExceed = parsed.data.stopOnBudgetExceed;

  const [org] = await db.update(organizationsTable).set(updates)
    .where(eq(organizationsTable.id, orgId)).returning();

  res.json(org);
});

export default router;
