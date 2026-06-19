import { Router } from "express";
import { eq, and, gte, lte, sum, count } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  plansTable,
  subscriptionsTable,
  usageRecordsTable,
  tasksTable,
  workflowRunsTable,
  workflowsTable,
  executionsTable,
} from "@workspace/db";

const router = Router();

// Seed default plans if not exist
async function ensurePlansExist() {
  const existing = await db.select().from(plansTable);
  if (existing.length > 0) return;
  await db.insert(plansTable).values([
    {
      name: "starter",
      displayName: "Starter",
      description: "Dành cho cá nhân và startup nhỏ",
      priceMonthly: "0",
      priceYearly: "0",
      maxAgents: 3,
      maxWorkflows: 5,
      maxTasksPerMonth: 200,
      maxTokensPerMonth: 500000,
      maxTeamMembers: 1,
    },
    {
      name: "growth",
      displayName: "Growth",
      description: "Dành cho doanh nghiệp đang phát triển",
      priceMonthly: "49",
      priceYearly: "490",
      maxAgents: 15,
      maxWorkflows: 30,
      maxTasksPerMonth: 2000,
      maxTokensPerMonth: 5000000,
      maxTeamMembers: 5,
    },
    {
      name: "enterprise",
      displayName: "Enterprise",
      description: "Không giới hạn — cho doanh nghiệp lớn",
      priceMonthly: "199",
      priceYearly: "1990",
      maxAgents: 9999,
      maxWorkflows: 9999,
      maxTasksPerMonth: 99999,
      maxTokensPerMonth: 999999999,
      maxTeamMembers: 9999,
    },
  ]);
}

// GET /subscriptions/plans
router.get("/subscriptions/plans", async (req, res): Promise<void> => {
  await ensurePlansExist();
  const plans = await db.select().from(plansTable).where(eq(plansTable.isActive, true));
  res.json(plans);
});

// GET /subscriptions/current
router.get("/subscriptions/current", async (req, res): Promise<void> => {
  await ensurePlansExist();
  const orgId = req.user!.organizationId;

  let [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.organizationId, orgId), eq(subscriptionsTable.status, "active")));

  // Auto-provision Starter if no subscription
  if (!sub) {
    const [starterPlan] = await db.select().from(plansTable).where(eq(plansTable.name, "starter"));
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    [sub] = await db.insert(subscriptionsTable).values({
      organizationId: orgId,
      planId: starterPlan.id,
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
    }).returning();
  }

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, sub.planId));

  // Current period usage
  const [taskUsage] = await db
    .select({ used: count(tasksTable.id) })
    .from(tasksTable)
    .where(and(
      eq(tasksTable.organizationId, orgId),
      gte(tasksTable.createdAt, sub.currentPeriodStart),
      lte(tasksTable.createdAt, sub.currentPeriodEnd),
    ));

  const [workflowUsage] = await db
    .select({ used: count(workflowRunsTable.id) })
    .from(workflowRunsTable)
    .innerJoin(workflowsTable, and(
      eq(workflowRunsTable.workflowId, workflowsTable.id),
      eq(workflowsTable.organizationId, orgId),
    ))
    .where(and(
      gte(workflowRunsTable.createdAt, sub.currentPeriodStart),
      lte(workflowRunsTable.createdAt, sub.currentPeriodEnd),
    ));

  const [tokenUsage] = await db
    .select({
      tokens: sum(executionsTable.totalTokens),
      cost: sum(executionsTable.estimatedCost),
    })
    .from(executionsTable)
    .innerJoin(tasksTable, and(
      eq(executionsTable.taskId, tasksTable.id),
      eq(tasksTable.organizationId, orgId),
    ))
    .where(and(
      gte(executionsTable.createdAt, sub.currentPeriodStart),
      lte(executionsTable.createdAt, sub.currentPeriodEnd),
    ));

  const tasksUsed = Number(taskUsage?.used ?? 0);
  const workflowsUsed = Number(workflowUsage?.used ?? 0);
  const tokensUsed = Number(tokenUsage?.tokens ?? 0);
  const estimatedCost = Number(tokenUsage?.cost ?? 0);

  res.json({
    subscription: sub,
    plan,
    usage: {
      tasksUsed,
      workflowsUsed,
      tokensUsed,
      estimatedCost,
      tasksRemaining: Math.max(0, plan.maxTasksPerMonth - tasksUsed),
      workflowsRemaining: Math.max(0, plan.maxWorkflows - workflowsUsed),
      tokensRemaining: Math.max(0, plan.maxTokensPerMonth - tokensUsed),
      tasksPercent: Math.min(100, Math.round((tasksUsed / plan.maxTasksPerMonth) * 100)),
      tokensPercent: Math.min(100, Math.round((tokensUsed / plan.maxTokensPerMonth) * 100)),
    },
  });
});

// POST /subscriptions/upgrade
const UpgradeBody = z.object({ planName: z.enum(["starter", "growth", "enterprise"]) });

router.post("/subscriptions/upgrade", async (req, res): Promise<void> => {
  const parsed = UpgradeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const orgId = req.user!.organizationId;
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.name, parsed.data.planName));
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }

  // Cancel existing
  await db.update(subscriptionsTable)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(and(eq(subscriptionsTable.organizationId, orgId), eq(subscriptionsTable.status, "active")));

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const [sub] = await db.insert(subscriptionsTable).values({
    organizationId: orgId,
    planId: plan.id,
    status: "active",
    currentPeriodStart: new Date(),
    currentPeriodEnd: periodEnd,
  }).returning();

  res.json({ subscription: sub, plan });
});

export default router;
