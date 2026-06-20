import { Router } from "express";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  resourceQuotasTable,
  resourceUsageTable,
  kernelAgentsTable,
} from "@workspace/db";

const router = Router();

// ─── ResourceManager: Quotas ──────────────────────────────────────────────────

router.get("/api/os/resources/quotas", async (req, res) => {
  const orgId = req.user!.organizationId;
  const quotas = await db.select().from(resourceQuotasTable)
    .where(eq(resourceQuotasTable.organizationId, orgId))
    .orderBy(desc(resourceQuotasTable.createdAt));
  res.json({ quotas });
});

router.post("/api/os/resources/quotas", async (req, res) => {
  const schema = z.object({
    agentId: z.number().optional(),
    scope: z.enum(["agent", "organization", "department"]).default("agent"),
    cpuLimitMs: z.number().default(60000),
    ramLimitMb: z.number().default(512),
    tokenLimit: z.number().default(100000),
    costLimitUsd: z.number().default(10),
    requestsPerHour: z.number().default(1000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const orgId = req.user!.organizationId;

  const [quota] = await db.insert(resourceQuotasTable).values({
    organizationId: orgId,
    ...parsed.data,
    periodStart: new Date(),
  }).returning();
  res.status(201).json({ quota });
});

router.patch("/api/os/resources/quotas/:id", async (req, res) => {
  const schema = z.object({
    cpuLimitMs: z.number().optional(),
    ramLimitMb: z.number().optional(),
    tokenLimit: z.number().optional(),
    costLimitUsd: z.number().optional(),
    requestsPerHour: z.number().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const orgId = req.user!.organizationId;
  const [quota] = await db.update(resourceQuotasTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(resourceQuotasTable.id, Number(req.params.id)), eq(resourceQuotasTable.organizationId, orgId)))
    .returning();
  res.json({ quota });
});

// ─── ResourceManager: Usage ───────────────────────────────────────────────────

router.get("/api/os/resources/usage", async (req, res) => {
  const orgId = req.user!.organizationId;
  const since = req.query.since ? new Date(req.query.since as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);

  const usage = await db.select().from(resourceUsageTable)
    .where(and(
      eq(resourceUsageTable.organizationId, orgId),
      gte(resourceUsageTable.recordedAt, since),
    ))
    .orderBy(desc(resourceUsageTable.recordedAt))
    .limit(500);

  const aggregated = await db.select({
    totalCpu: sql<number>`COALESCE(SUM(${resourceUsageTable.cpuMs}), 0)`,
    totalRam: sql<number>`COALESCE(AVG(${resourceUsageTable.ramMb}), 0)`,
    totalTokens: sql<number>`COALESCE(SUM(${resourceUsageTable.tokensUsed}), 0)`,
    totalCost: sql<number>`COALESCE(SUM(${resourceUsageTable.costUsd}), 0)`,
    totalRequests: sql<number>`COALESCE(SUM(${resourceUsageTable.requestCount}), 0)`,
  }).from(resourceUsageTable)
    .where(and(eq(resourceUsageTable.organizationId, orgId), gte(resourceUsageTable.recordedAt, since)));

  res.json({ usage, summary: aggregated[0] ?? { totalCpu: 0, totalRam: 0, totalTokens: 0, totalCost: 0, totalRequests: 0 } });
});

router.post("/api/os/resources/usage", async (req, res) => {
  const schema = z.object({
    agentId: z.number().optional(),
    agentName: z.string().optional(),
    cpuMs: z.number().default(0),
    ramMb: z.number().default(0),
    tokensUsed: z.number().default(0),
    costUsd: z.number().default(0),
    requestCount: z.number().default(1),
    operation: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const orgId = req.user!.organizationId;

  const [record] = await db.insert(resourceUsageTable).values({
    organizationId: orgId,
    ...parsed.data,
  }).returning();

  if (parsed.data.agentId) {
    await db.update(resourceQuotasTable).set({
      currentCpuMs: sql`${resourceQuotasTable.currentCpuMs} + ${parsed.data.cpuMs}`,
      currentRamMb: sql`${resourceQuotasTable.currentRamMb} + ${parsed.data.ramMb}`,
      currentTokens: sql`${resourceQuotasTable.currentTokens} + ${parsed.data.tokensUsed}`,
      currentCostUsd: sql`${resourceQuotasTable.currentCostUsd} + ${parsed.data.costUsd}`,
      currentRequests: sql`${resourceQuotasTable.currentRequests} + ${parsed.data.requestCount}`,
      updatedAt: new Date(),
    }).where(and(
      eq(resourceQuotasTable.agentId, parsed.data.agentId),
      eq(resourceQuotasTable.organizationId, orgId),
    ));
  }
  res.status(201).json({ record });
});

// ─── Simulate resource usage snapshot ────────────────────────────────────────

router.post("/api/os/resources/snapshot", async (req, res) => {
  const orgId = req.user!.organizationId;
  const agents = await db.select().from(kernelAgentsTable)
    .where(and(eq(kernelAgentsTable.organizationId, orgId), eq(kernelAgentsTable.status, "RUNNING")));

  const records = [];
  for (const agent of agents) {
    const [record] = await db.insert(resourceUsageTable).values({
      organizationId: orgId,
      agentId: agent.id,
      agentName: agent.name,
      cpuMs: Math.floor(Math.random() * 5000) + 100,
      ramMb: Math.floor(Math.random() * 256) + 32,
      tokensUsed: Math.floor(Math.random() * 2000) + 50,
      costUsd: parseFloat((Math.random() * 0.05 + 0.001).toFixed(4)),
      requestCount: Math.floor(Math.random() * 20) + 1,
      operation: "agent_execution",
    }).returning();
    records.push(record);
  }
  res.json({ snapshot: records, agentCount: agents.length });
});

export default router;
