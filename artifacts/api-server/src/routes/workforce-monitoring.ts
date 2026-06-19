import { Router } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db,
  agentsTable,
  workforceEventsTable,
  agentMessagesTable,
  sharedMemoriesTable,
  agentRegistryTable,
  workflowRunsTable,
  executionsTable,
  workflowsTable,
} from "@workspace/db";

const router = Router();

// GET /api/workforce/monitoring — Full real-time monitoring snapshot
router.get("/api/workforce/monitoring", async (req, res) => {
  const orgId = req.user!.organizationId;

  const [agents] = await db.select({
    total: sql<number>`count(*)::int`,
  }).from(agentsTable).where(eq(agentsTable.organizationId, orgId));

  const [registeredAgents] = await db.select({
    active: sql<number>`count(*) filter (where status = 'active')::int`,
    inactive: sql<number>`count(*) filter (where status = 'inactive')::int`,
    total: sql<number>`count(*)::int`,
    avgReputation: sql<number>`round(avg(reputation_score)::numeric, 1)::float`,
    avgSuccessRate: sql<number>`round(avg(success_rate)::numeric, 1)::float`,
    totalExecutions: sql<number>`sum(total_executions)::int`,
  }).from(agentRegistryTable).where(eq(agentRegistryTable.ownerOrganizationId, orgId));

  const [messageStats] = await db.select({
    total: sql<number>`count(*)::int`,
    pending: sql<number>`count(*) filter (where status = 'pending')::int`,
    done: sql<number>`count(*) filter (where status = 'done')::int`,
    failed: sql<number>`count(*) filter (where status = 'failed')::int`,
    last24h: sql<number>`count(*) filter (where created_at >= now() - interval '24 hours')::int`,
    lastHour: sql<number>`count(*) filter (where created_at >= now() - interval '1 hour')::int`,
  }).from(agentMessagesTable).where(eq(agentMessagesTable.organizationId, orgId));

  const [memoryStats] = await db.select({
    total: sql<number>`count(*)::int`,
    personal: sql<number>`count(*) filter (where scope = 'personal')::int`,
    team: sql<number>`count(*) filter (where scope = 'team')::int`,
    department: sql<number>`count(*) filter (where scope = 'department')::int`,
    organization: sql<number>`count(*) filter (where scope = 'organization')::int`,
  }).from(sharedMemoriesTable).where(eq(sharedMemoriesTable.organizationId, orgId));

  const [eventStats] = await db.select({
    total: sql<number>`count(*)::int`,
    last24h: sql<number>`count(*) filter (where created_at >= now() - interval '24 hours')::int`,
    errors: sql<number>`count(*) filter (where severity in ('error', 'critical'))::int`,
    lastHour: sql<number>`count(*) filter (where created_at >= now() - interval '1 hour')::int`,
  }).from(workforceEventsTable).where(eq(workforceEventsTable.organizationId, orgId));

  const [workflowStats] = await db.select({
    running: sql<number>`count(*) filter (where status = 'running')::int`,
    completed: sql<number>`count(*) filter (where status = 'completed')::int`,
    failed: sql<number>`count(*) filter (where status = 'failed')::int`,
    total: sql<number>`count(*)::int`,
  }).from(workflowRunsTable).where(eq(workflowRunsTable.organizationId, orgId));

  const [executionStats] = await db.select({
    total: sql<number>`count(*)::int`,
    today: sql<number>`count(*) filter (where created_at >= now() - interval '24 hours')::int`,
    avgDurationMs: sql<number>`round(avg(duration_ms)::numeric, 0)::int`,
    totalCostUsd: sql<number>`round(sum(cost_usd)::numeric, 4)::float`,
  }).from(executionsTable).where(eq(executionsTable.organizationId, orgId));

  const recentEvents = await db.select().from(workforceEventsTable)
    .where(eq(workforceEventsTable.organizationId, orgId))
    .orderBy(desc(workforceEventsTable.createdAt))
    .limit(20);

  const eventsByType = await db.select({
    eventType: workforceEventsTable.eventType,
    count: sql<number>`count(*)::int`,
  }).from(workforceEventsTable)
    .where(and(
      eq(workforceEventsTable.organizationId, orgId),
      sql`created_at >= now() - interval '24 hours'`,
    ))
    .groupBy(workforceEventsTable.eventType)
    .orderBy(desc(sql`count(*)`))
    .limit(8);

  const topAgents = await db.select().from(agentRegistryTable)
    .where(eq(agentRegistryTable.ownerOrganizationId, orgId))
    .orderBy(desc(agentRegistryTable.reputationScore))
    .limit(5);

  res.json({
    snapshot: {
      timestamp: new Date().toISOString(),
      agents: {
        total: agents?.total ?? 0,
        registered: registeredAgents?.total ?? 0,
        active: registeredAgents?.active ?? 0,
        avgReputation: registeredAgents?.avgReputation ?? 100,
        avgSuccessRate: registeredAgents?.avgSuccessRate ?? 100,
        totalExecutions: registeredAgents?.totalExecutions ?? 0,
      },
      messages: {
        total: messageStats?.total ?? 0,
        pending: messageStats?.pending ?? 0,
        done: messageStats?.done ?? 0,
        failed: messageStats?.failed ?? 0,
        last24h: messageStats?.last24h ?? 0,
        lastHour: messageStats?.lastHour ?? 0,
      },
      memory: {
        total: memoryStats?.total ?? 0,
        personal: memoryStats?.personal ?? 0,
        team: memoryStats?.team ?? 0,
        department: memoryStats?.department ?? 0,
        organization: memoryStats?.organization ?? 0,
      },
      events: {
        total: eventStats?.total ?? 0,
        last24h: eventStats?.last24h ?? 0,
        lastHour: eventStats?.lastHour ?? 0,
        errors: eventStats?.errors ?? 0,
      },
      workflows: {
        running: workflowStats?.running ?? 0,
        completed: workflowStats?.completed ?? 0,
        failed: workflowStats?.failed ?? 0,
        total: workflowStats?.total ?? 0,
      },
      executions: {
        total: executionStats?.total ?? 0,
        today: executionStats?.today ?? 0,
        avgDurationMs: executionStats?.avgDurationMs ?? 0,
        totalCostUsd: executionStats?.totalCostUsd ?? 0,
      },
    },
    recentEvents,
    eventsByType,
    topAgents,
  });
});

// GET /api/workforce/monitoring/health
router.get("/api/workforce/monitoring/health", async (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  });
});

export default router;
