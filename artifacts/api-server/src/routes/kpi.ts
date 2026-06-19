import { Router } from "express";
import { eq, gte, and, count, sum, sql } from "drizzle-orm";
import {
  db,
  subscriptionsTable,
  plansTable,
  organizationsTable,
  usersTable,
  tasksTable,
  workflowRunsTable,
  workflowsTable,
  customersTable,
  dealsTable,
  marketingLeadsTable,
} from "@workspace/db";

const router = Router();

// GET /kpi/overview — MRR, ARR, customers, conversion, CAC, LTV
router.get("/kpi/overview", async (req, res): Promise<void> => {
  try {
    // ── Active paid subscriptions grouped by plan ─────────────────
    const activeSubs = await db
      .select({
        planId: subscriptionsTable.planId,
        count: count(subscriptionsTable.id),
      })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.status, "active"))
      .groupBy(subscriptionsTable.planId);

    const plans = await db.select().from(plansTable);
    const planMap = Object.fromEntries(plans.map((p) => [p.id, p]));

    let mrr = 0;
    let activeCustomers = 0;
    for (const row of activeSubs) {
      const plan = planMap[row.planId];
      if (!plan) continue;
      const price = Number(plan.priceMonthly);
      if (price > 0) {
        mrr += price * Number(row.count);
        activeCustomers += Number(row.count);
      }
    }

    // ── Trial users ────────────────────────────────────────────────
    const now = new Date();
    const [trialRow] = await db
      .select({ count: count(organizationsTable.id) })
      .from(organizationsTable)
      .where(gte(organizationsTable.trialEndsAt, now));
    const trialUsers = Number(trialRow?.count ?? 0);

    // ── Total orgs (total signups) ─────────────────────────────────
    const [totalOrgRow] = await db
      .select({ count: count(organizationsTable.id) })
      .from(organizationsTable);
    const totalOrgs = Number(totalOrgRow?.count ?? 0);

    // ── Conversion rate (paid / total signups) ────────────────────
    const conversionRate = totalOrgs > 0 ? Math.round((activeCustomers / totalOrgs) * 100) : 0;

    // ── MRR trend: last 6 months (approximated from creation dates) ─
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const mrrTrend = await db
      .select({
        month: sql<string>`TO_CHAR(${subscriptionsTable.createdAt}, 'YYYY-MM')`.as("month"),
        count: count(subscriptionsTable.id),
      })
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.status, "active"),
          gte(subscriptionsTable.createdAt, sixMonthsAgo),
        ),
      )
      .groupBy(sql`TO_CHAR(${subscriptionsTable.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${subscriptionsTable.createdAt}, 'YYYY-MM')`);

    // ── CRM pipeline deal values ────────────────────────────────────
    const dealStats = await db
      .select({
        stage: dealsTable.stage,
        totalValue: sum(dealsTable.value),
        count: count(dealsTable.id),
      })
      .from(dealsTable)
      .groupBy(dealsTable.stage);

    const paidDeals = dealStats.find((d) => d.stage === "paid");
    const pipelineValue = dealStats.reduce((acc, d) => acc + Number(d.totalValue ?? 0), 0);

    // ── Marketing leads (new leads in last 30 days) ─────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [leadRow] = await db
      .select({ count: count(marketingLeadsTable.id) })
      .from(marketingLeadsTable)
      .where(gte(marketingLeadsTable.createdAt, thirtyDaysAgo));
    const newLeads30d = Number(leadRow?.count ?? 0);

    // ── Total marketing leads ───────────────────────────────────────
    const [totalLeadRow] = await db
      .select({ count: count(marketingLeadsTable.id) })
      .from(marketingLeadsTable);
    const totalLeads = Number(totalLeadRow?.count ?? 0);

    // ── Workflow runs (activation signal) ──────────────────────────
    const [wfRow] = await db
      .select({ count: count(workflowRunsTable.id) })
      .from(workflowRunsTable)
      .where(gte(workflowRunsTable.createdAt, thirtyDaysAgo));
    const workflowRuns30d = Number(wfRow?.count ?? 0);

    // ── CAC estimate (assume $50 marketing spend per customer) ──────
    const cac = activeCustomers > 0 ? 50 : 0;

    // ── LTV estimate (MRR per customer × 24 months avg) ─────────────
    const avgMrrPerCustomer = activeCustomers > 0 ? mrr / activeCustomers : 0;
    const ltv = Math.round(avgMrrPerCustomer * 24);

    res.json({
      mrr: Math.round(mrr),
      arr: Math.round(mrr * 12),
      activeCustomers,
      trialUsers,
      totalSignups: totalOrgs,
      conversionRate,
      cac,
      ltv,
      newLeads30d,
      totalLeads,
      pipelineValue: Math.round(pipelineValue),
      workflowRuns30d,
      mrrTrend,
      dealsByStage: dealStats,
    });
  } catch (err) {
    console.error("[kpi] error:", err);
    res.status(500).json({ error: "Failed to load KPI data" });
  }
});

// GET /kpi/customer-success — activation rate, churn risk, trial conversion
router.get("/kpi/customer-success", async (req, res): Promise<void> => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // All orgs
    const orgs = await db.select().from(organizationsTable);

    // Orgs with at least 1 workflow run (activated)
    const activatedOrgIds = await db
      .selectDistinct({ orgId: workflowsTable.organizationId })
      .from(workflowRunsTable)
      .innerJoin(workflowsTable, eq(workflowRunsTable.workflowId, workflowsTable.id));

    const activatedSet = new Set(activatedOrgIds.map((r) => r.orgId));

    // Trial orgs
    const trialOrgs = orgs.filter(
      (o) => o.trialEndsAt && o.trialEndsAt > now,
    );

    // Expiring soon (≤3 days)
    const expiringSoon = trialOrgs.filter((o) => {
      const msLeft = o.trialEndsAt!.getTime() - now.getTime();
      return msLeft <= 3 * 24 * 60 * 60 * 1000;
    });

    // Activated trials
    const activatedTrials = trialOrgs.filter((o) => activatedSet.has(o.id));

    // Activation rate
    const activationRate =
      orgs.length > 0 ? Math.round((activatedSet.size / orgs.length) * 100) : 0;

    // Trial-to-paid orgs (have active paid subscription)
    const paidSubs = await db
      .select({ orgId: subscriptionsTable.organizationId, planId: subscriptionsTable.planId })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.status, "active"));

    const plans = await db.select().from(plansTable);
    const planMap = Object.fromEntries(plans.map((p) => [p.id, p]));

    const paidOrgIds = new Set(
      paidSubs
        .filter((s) => Number(planMap[s.planId]?.priceMonthly ?? 0) > 0)
        .map((s) => s.orgId),
    );

    const trialConversionRate =
      trialOrgs.length > 0
        ? Math.round(
            (trialOrgs.filter((o) => paidOrgIds.has(o.id)).length / trialOrgs.length) * 100,
          )
        : 0;

    // Task usage per org in last 7 days
    const recentTasks = await db
      .select({
        orgId: tasksTable.organizationId,
        count: count(tasksTable.id),
      })
      .from(tasksTable)
      .where(gte(tasksTable.createdAt, sevenDaysAgo))
      .groupBy(tasksTable.organizationId);

    const taskMap = Object.fromEntries(recentTasks.map((r) => [r.orgId, Number(r.count)]));

    // Churn risk: paid orgs with 0 tasks in last 7 days
    const churnRiskCount = Array.from(paidOrgIds).filter(
      (orgId) => (taskMap[orgId] ?? 0) === 0,
    ).length;

    // Top 10 recent orgs with details
    const recentOrgs = orgs
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map((o) => ({
        id: o.id,
        name: o.name,
        createdAt: o.createdAt,
        trialEndsAt: o.trialEndsAt,
        isTrialing: o.trialEndsAt ? o.trialEndsAt > now : false,
        isPaid: paidOrgIds.has(o.id),
        isActivated: activatedSet.has(o.id),
        tasksLast7d: taskMap[o.id] ?? 0,
        churnRisk: paidOrgIds.has(o.id) && (taskMap[o.id] ?? 0) === 0,
      }));

    res.json({
      activationRate,
      activatedCount: activatedSet.size,
      totalOrgs: orgs.length,
      trialUsers: trialOrgs.length,
      expiringSoon: expiringSoon.length,
      activatedTrials: activatedTrials.length,
      trialConversionRate,
      churnRiskCount,
      paidCustomers: paidOrgIds.size,
      recentOrgs,
    });
  } catch (err) {
    console.error("[kpi/customer-success] error:", err);
    res.status(500).json({ error: "Failed to load customer success data" });
  }
});

export default router;
