import { Router } from "express";
import { eq, gte, lte, and, avg, count, sum, sql } from "drizzle-orm";
import { db, executionsTable, tasksTable } from "@workspace/db";
import { getQueueStats } from "../lib/queue";

const router = Router();

// GET /analytics/metrics — observability overview
router.get("/analytics/metrics", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const days = Math.min(Number(req.query.days) || 7, 30);

  const since = new Date();
  since.setDate(since.getDate() - days);

  // Aggregate execution stats
  const [stats] = await db.select({
    total: count(executionsTable.id),
    successful: count(sql`CASE WHEN ${executionsTable.status} = 'completed' THEN 1 END`),
    failed: count(sql`CASE WHEN ${executionsTable.status} = 'failed' THEN 1 END`),
    avgDurationMs: avg(executionsTable.durationMs),
    totalTokens: sum(executionsTable.totalTokens),
    totalCost: sum(executionsTable.estimatedCost),
    avgQuality: avg(executionsTable.qualityScore),
    avgAccuracy: avg(executionsTable.accuracyScore),
    avgCompleteness: avg(executionsTable.completenessScore),
  }).from(executionsTable)
    .where(and(
      eq(executionsTable.organizationId, orgId),
      gte(executionsTable.startedAt, since),
    ));

  // Per-day breakdown
  const daily = await db.select({
    date: sql<string>`DATE(${executionsTable.startedAt})`.as("date"),
    executions: count(executionsTable.id),
    successful: count(sql`CASE WHEN ${executionsTable.status} = 'completed' THEN 1 END`),
    tokens: sum(executionsTable.totalTokens),
    cost: sum(executionsTable.estimatedCost),
    avgDuration: avg(executionsTable.durationMs),
  }).from(executionsTable)
    .where(and(
      eq(executionsTable.organizationId, orgId),
      gte(executionsTable.startedAt, since),
    ))
    .groupBy(sql`DATE(${executionsTable.startedAt})`)
    .orderBy(sql`DATE(${executionsTable.startedAt})`);

  // Latency percentiles (p50, p95) from raw durations
  const durations = await db.select({ d: executionsTable.durationMs })
    .from(executionsTable)
    .where(and(
      eq(executionsTable.organizationId, orgId),
      gte(executionsTable.startedAt, since),
      sql`${executionsTable.durationMs} IS NOT NULL`,
      eq(executionsTable.status, "completed"),
    ))
    .orderBy(executionsTable.durationMs);

  let p50 = null, p95 = null;
  if (durations.length > 0) {
    const sorted = durations.map(d => d.d!).sort((a, b) => a - b);
    p50 = sorted[Math.floor(sorted.length * 0.5)];
    p95 = sorted[Math.floor(sorted.length * 0.95)];
  }

  const total = Number(stats?.total ?? 0);
  const successful = Number(stats?.successful ?? 0);
  const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;

  // Queue stats
  let queueStats = null;
  try { queueStats = await getQueueStats(); } catch { /* queue might not be ready */ }

  res.json({
    period: { days, since: since.toISOString() },
    summary: {
      totalExecutions: total,
      successfulExecutions: successful,
      failedExecutions: Number(stats?.failed ?? 0),
      successRate,
      avgDurationMs: Math.round(Number(stats?.avgDurationMs ?? 0)),
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      totalTokens: Number(stats?.totalTokens ?? 0),
      totalCost: Number(Number(stats?.totalCost ?? 0).toFixed(4)),
      avgQualityScore: stats?.avgQuality ? Math.round(Number(stats.avgQuality)) : null,
      avgAccuracyScore: stats?.avgAccuracy ? Math.round(Number(stats.avgAccuracy)) : null,
      avgCompletenessScore: stats?.avgCompleteness ? Math.round(Number(stats.avgCompleteness)) : null,
    },
    daily,
    queues: queueStats,
  });
});

export default router;
