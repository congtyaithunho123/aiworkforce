import { Router } from "express";
import { eq, and, desc, sql, ilike, or } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  agentMessagesTable,
  agentRegistryTable,
  workforceEventsTable,
  sharedMemoriesTable,
  agentsTable,
  organizationsTable,
} from "@workspace/db";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Emit workforce event
// ─────────────────────────────────────────────────────────────────────────────
export async function emitEvent(
  organizationId: number,
  eventType: string,
  payload: Record<string, unknown> = {},
  opts: { severity?: string; sourceType?: string; sourceId?: number; message?: string; correlationId?: string } = {},
) {
  try {
    await db.insert(workforceEventsTable).values({
      organizationId,
      eventType,
      severity: opts.severity ?? "info",
      sourceType: opts.sourceType ?? "system",
      sourceId: opts.sourceId,
      payload,
      message: opts.message,
      correlationId: opts.correlationId,
    });
  } catch {
    /* best-effort */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. AGENT COMMUNICATION BUS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/workforce/bus/send
router.post("/api/workforce/bus/send", async (req, res) => {
  const schema = z.object({
    fromAgentId: z.number().optional(),
    toAgentId: z.number(),
    messageType: z.enum(["task", "query", "result", "event", "broadcast"]).default("task"),
    payload: z.record(z.unknown()).default({}),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const orgId = req.user!.organizationId;
  const { fromAgentId, toAgentId, messageType, payload } = parsed.data;

  const [msg] = await db.insert(agentMessagesTable).values({
    organizationId: orgId,
    fromAgentId: fromAgentId ?? null,
    toAgentId,
    messageType,
    payload,
    status: "pending",
  }).returning();

  await emitEvent(orgId, "MESSAGE_SENT", { messageId: msg.id, fromAgentId, toAgentId, messageType }, {
    sourceType: "bus",
    message: `Message ${msg.id} sent from agent ${fromAgentId} → ${toAgentId}`,
  });

  res.json({ message: msg });
});

// GET /api/workforce/bus/messages
router.get("/api/workforce/bus/messages", async (req, res) => {
  const orgId = req.user!.organizationId;
  const agentId = req.query.agentId ? Number(req.query.agentId) : undefined;
  const status = req.query.status as string | undefined;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);

  const conditions: ReturnType<typeof eq>[] = [eq(agentMessagesTable.organizationId, orgId)];
  if (agentId) conditions.push(eq(agentMessagesTable.toAgentId, agentId));
  if (status) conditions.push(eq(agentMessagesTable.status, status));

  const messages = await db.select().from(agentMessagesTable)
    .where(and(...conditions))
    .orderBy(desc(agentMessagesTable.createdAt))
    .limit(limit);

  res.json({ messages });
});

// PATCH /api/workforce/bus/messages/:id/status
router.patch("/api/workforce/bus/messages/:id/status", async (req, res) => {
  const msgId = Number(req.params.id);
  const { status } = z.object({ status: z.enum(["pending", "delivered", "processing", "done", "failed"]) }).parse(req.body);
  const orgId = req.user!.organizationId;

  const [updated] = await db.update(agentMessagesTable)
    .set({ status, ...(status === "done" || status === "delivered" ? { processedAt: new Date() } : {}) })
    .where(and(eq(agentMessagesTable.id, msgId), eq(agentMessagesTable.organizationId, orgId)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Message not found" });

  await emitEvent(orgId, "MESSAGE_DELIVERED", { messageId: msgId, status }, { sourceType: "bus" });
  res.json({ message: updated });
});

// GET /api/workforce/bus/stats
router.get("/api/workforce/bus/stats", async (req, res) => {
  const orgId = req.user!.organizationId;

  const [stats] = await db.select({
    total: sql<number>`count(*)::int`,
    pending: sql<number>`count(*) filter (where status = 'pending')::int`,
    done: sql<number>`count(*) filter (where status = 'done')::int`,
    failed: sql<number>`count(*) filter (where status = 'failed')::int`,
    today: sql<number>`count(*) filter (where created_at >= now() - interval '24 hours')::int`,
  }).from(agentMessagesTable).where(eq(agentMessagesTable.organizationId, orgId));

  res.json({ stats });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GLOBAL AGENT REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/workforce/registry
router.post("/api/workforce/registry", async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    version: z.string().default("1.0.0"),
    capabilities: z.array(z.string()).default([]),
    description: z.string().optional(),
    model: z.string().default("gpt-4o-mini"),
    tags: z.array(z.string()).default([]),
    endpoint: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const orgId = req.user!.organizationId;
  const [entry] = await db.insert(agentRegistryTable).values({
    ...parsed.data,
    ownerOrganizationId: orgId,
  }).returning();

  await emitEvent(orgId, "AGENT_REGISTERED", { agentId: entry.id, name: entry.name }, {
    sourceType: "registry",
    message: `Agent "${entry.name}" v${entry.version} registered`,
  });

  res.status(201).json({ agent: entry });
});

// GET /api/workforce/registry
router.get("/api/workforce/registry", async (req, res) => {
  const orgId = req.user!.organizationId;
  const capability = req.query.capability as string | undefined;
  const search = req.query.search as string | undefined;
  const status = (req.query.status as string) ?? "active";

  const conditions: ReturnType<typeof eq>[] = [
    eq(agentRegistryTable.ownerOrganizationId, orgId),
    eq(agentRegistryTable.status, status),
  ];
  if (search) {
    conditions.push(
      or(
        ilike(agentRegistryTable.name, `%${search}%`),
        ilike(agentRegistryTable.description ?? "", `%${search}%`),
      ) as ReturnType<typeof eq>
    );
  }

  let agents = await db.select().from(agentRegistryTable)
    .where(and(...conditions))
    .orderBy(desc(agentRegistryTable.reputationScore))
    .limit(100);

  if (capability) {
    agents = agents.filter((a) => {
      const caps = a.capabilities as string[];
      return caps.some((c) => c.toLowerCase().includes(capability.toLowerCase()));
    });
  }

  res.json({ agents });
});

// GET /api/workforce/registry/:id
router.get("/api/workforce/registry/:id", async (req, res) => {
  const orgId = req.user!.organizationId;
  const [agent] = await db.select().from(agentRegistryTable)
    .where(and(eq(agentRegistryTable.id, Number(req.params.id)), eq(agentRegistryTable.ownerOrganizationId, orgId)));
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  res.json({ agent });
});

// PATCH /api/workforce/registry/:id/reputation
router.patch("/api/workforce/registry/:id/reputation", async (req, res) => {
  const { success, failed, qualityScore, humanFeedbackScore } = z.object({
    success: z.boolean().optional(),
    failed: z.boolean().optional(),
    qualityScore: z.number().min(0).max(100).optional(),
    humanFeedbackScore: z.number().min(0).max(100).optional(),
  }).parse(req.body);

  const orgId = req.user!.organizationId;
  const id = Number(req.params.id);

  const [current] = await db.select().from(agentRegistryTable)
    .where(and(eq(agentRegistryTable.id, id), eq(agentRegistryTable.ownerOrganizationId, orgId)));
  if (!current) return res.status(404).json({ error: "Not found" });

  const newTotal = current.totalExecutions + (success || failed ? 1 : 0);
  const newSuccess = current.successCount + (success ? 1 : 0);
  const newFailure = current.failureCount + (failed ? 1 : 0);
  const newSuccessRate = newTotal > 0 ? (newSuccess / newTotal) * 100 : 100;

  const newQuality = qualityScore !== undefined
    ? (current.qualityScore * 0.8 + qualityScore * 0.2)
    : current.qualityScore;
  const newHuman = humanFeedbackScore !== undefined
    ? (current.humanFeedbackScore * 0.8 + humanFeedbackScore * 0.2)
    : current.humanFeedbackScore;

  const newReputation = Math.round(
    newSuccessRate * 0.4 + newQuality * 0.3 + newHuman * 0.3
  );

  const [updated] = await db.update(agentRegistryTable).set({
    totalExecutions: newTotal,
    successCount: newSuccess,
    failureCount: newFailure,
    successRate: newSuccessRate,
    qualityScore: newQuality,
    humanFeedbackScore: newHuman,
    reputationScore: newReputation,
  }).where(and(eq(agentRegistryTable.id, id), eq(agentRegistryTable.ownerOrganizationId, orgId)))
    .returning();

  res.json({ agent: updated });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. CAPABILITY ROUTER
// ─────────────────────────────────────────────────────────────────────────────

const CAPABILITY_MAP: Record<string, string[]> = {
  "lead": ["sales", "sdr", "lead-gen", "prospecting", "crm"],
  "email": ["email", "outreach", "copywriting", "marketing"],
  "content": ["content", "writing", "copywriting", "seo", "blog"],
  "research": ["research", "analysis", "market-research", "competitor"],
  "workflow": ["workflow", "automation", "orchestration", "pipeline"],
  "code": ["code", "engineering", "debugging", "dev"],
  "data": ["data", "analytics", "reporting", "bi"],
  "customer": ["customer", "support", "crm", "success"],
};

// POST /api/workforce/route
router.post("/api/workforce/route", async (req, res) => {
  const { task, context } = z.object({
    task: z.string().min(1),
    context: z.record(z.unknown()).default({}),
  }).parse(req.body);

  const orgId = req.user!.organizationId;
  const lowerTask = task.toLowerCase();

  const matchedKeywords: string[] = [];
  for (const [keyword, caps] of Object.entries(CAPABILITY_MAP)) {
    if (lowerTask.includes(keyword)) matchedKeywords.push(...caps);
  }

  if (matchedKeywords.length === 0) {
    return res.json({
      routed: false,
      reason: "No capability match found",
      suggestions: Object.keys(CAPABILITY_MAP),
    });
  }

  const allRegistered = await db.select().from(agentRegistryTable)
    .where(and(
      eq(agentRegistryTable.ownerOrganizationId, orgId),
      eq(agentRegistryTable.status, "active"),
    ))
    .orderBy(desc(agentRegistryTable.reputationScore));

  const scored = allRegistered.map((agent) => {
    const caps = agent.capabilities as string[];
    const score = caps.filter((c) => matchedKeywords.some((m) => c.toLowerCase().includes(m))).length;
    return { agent, score };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);

  const best = scored[0];

  if (!best) {
    const allAgents = await db.select().from(agentsTable)
      .where(eq(agentsTable.organizationId, orgId)).limit(5);
    return res.json({ routed: false, reason: "No registered agents match this task", fallbackAgents: allAgents });
  }

  await emitEvent(orgId, "CAPABILITY_ROUTED", {
    task: task.slice(0, 100),
    matchedKeywords,
    routedToId: best.agent.id,
    routedToName: best.agent.name,
    score: best.score,
    context,
  }, { sourceType: "router", message: `Routed to ${best.agent.name}` });

  res.json({
    routed: true,
    agent: best.agent,
    matchedCapabilities: matchedKeywords,
    score: best.score,
    alternatives: scored.slice(1, 3).map((r) => r.agent),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. WORKFORCE EVENTS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/workforce/events
router.post("/api/workforce/events", async (req, res) => {
  const schema = z.object({
    eventType: z.string().min(1),
    severity: z.enum(["info", "warning", "error", "critical"]).default("info"),
    sourceType: z.string().default("api"),
    sourceId: z.number().optional(),
    payload: z.record(z.unknown()).default({}),
    message: z.string().optional(),
    correlationId: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const orgId = req.user!.organizationId;
  const [event] = await db.insert(workforceEventsTable).values({
    organizationId: orgId,
    ...parsed.data,
  }).returning();

  res.status(201).json({ event });
});

// GET /api/workforce/events
router.get("/api/workforce/events", async (req, res) => {
  const orgId = req.user!.organizationId;
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const eventType = req.query.eventType as string | undefined;
  const severity = req.query.severity as string | undefined;

  const conditions: ReturnType<typeof eq>[] = [eq(workforceEventsTable.organizationId, orgId)];
  if (eventType) conditions.push(eq(workforceEventsTable.eventType, eventType));
  if (severity) conditions.push(eq(workforceEventsTable.severity, severity));

  const events = await db.select().from(workforceEventsTable)
    .where(and(...conditions))
    .orderBy(desc(workforceEventsTable.createdAt))
    .limit(limit);

  res.json({ events });
});

// GET /api/workforce/events/stats
router.get("/api/workforce/events/stats", async (req, res) => {
  const orgId = req.user!.organizationId;

  const [stats] = await db.select({
    total: sql<number>`count(*)::int`,
    today: sql<number>`count(*) filter (where created_at >= now() - interval '24 hours')::int`,
    errors: sql<number>`count(*) filter (where severity = 'error' or severity = 'critical')::int`,
    byType: sql<Record<string, number>>`json_object_agg(event_type, cnt) filter (where event_type is not null)`,
  }).from(
    db.select({
      event_type: workforceEventsTable.eventType,
      severity: workforceEventsTable.severity,
      created_at: workforceEventsTable.createdAt,
      cnt: sql<number>`count(*)::int`,
    }).from(workforceEventsTable)
      .where(eq(workforceEventsTable.organizationId, orgId))
      .groupBy(workforceEventsTable.eventType, workforceEventsTable.severity, workforceEventsTable.createdAt)
      .as("sub")
  );

  const recentByType = await db.select({
    eventType: workforceEventsTable.eventType,
    count: sql<number>`count(*)::int`,
  }).from(workforceEventsTable)
    .where(eq(workforceEventsTable.organizationId, orgId))
    .groupBy(workforceEventsTable.eventType)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  res.json({ stats: { ...(stats ?? {}), total: stats?.total ?? 0, today: stats?.today ?? 0, errors: stats?.errors ?? 0 }, recentByType });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. SHARED MEMORY LAYER
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/workforce/memory
router.post("/api/workforce/memory", async (req, res) => {
  const schema = z.object({
    scope: z.enum(["personal", "team", "department", "organization"]).default("organization"),
    scopeId: z.number().optional(),
    key: z.string().min(1),
    value: z.unknown(),
    contentType: z.string().default("text"),
    ttlSeconds: z.number().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const orgId = req.user!.organizationId;
  const { scope, scopeId, key, value, contentType, ttlSeconds } = parsed.data;

  const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : undefined;

  const existing = await db.select().from(sharedMemoriesTable)
    .where(and(
      eq(sharedMemoriesTable.organizationId, orgId),
      eq(sharedMemoriesTable.scope, scope),
      eq(sharedMemoriesTable.key, key),
    )).limit(1);

  let memory;
  if (existing[0]) {
    [memory] = await db.update(sharedMemoriesTable)
      .set({ value: value as Record<string, unknown>, contentType, expiresAt })
      .where(eq(sharedMemoriesTable.id, existing[0].id))
      .returning();
  } else {
    [memory] = await db.insert(sharedMemoriesTable).values({
      organizationId: orgId,
      scope,
      scopeId: scopeId ?? null,
      key,
      value: value as Record<string, unknown>,
      contentType,
      ttlSeconds,
      expiresAt,
    }).returning();
  }

  await emitEvent(orgId, "MEMORY_WRITTEN", { scope, key, contentType }, { sourceType: "memory" });
  res.json({ memory });
});

// GET /api/workforce/memory
router.get("/api/workforce/memory", async (req, res) => {
  const orgId = req.user!.organizationId;
  const scope = req.query.scope as string | undefined;
  const key = req.query.key as string | undefined;

  const conditions: ReturnType<typeof eq>[] = [eq(sharedMemoriesTable.organizationId, orgId)];
  if (scope) conditions.push(eq(sharedMemoriesTable.scope, scope));
  if (key) conditions.push(eq(sharedMemoriesTable.key, key));

  const memories = await db.select().from(sharedMemoriesTable)
    .where(and(...conditions))
    .orderBy(desc(sharedMemoriesTable.updatedAt))
    .limit(100);

  const now = new Date();
  const valid = memories.filter((m) => !m.expiresAt || m.expiresAt > now);

  await emitEvent(orgId, "MEMORY_READ", { scope, key, count: valid.length }, { sourceType: "memory" });
  res.json({ memories: valid });
});

// DELETE /api/workforce/memory/:id
router.delete("/api/workforce/memory/:id", async (req, res) => {
  const orgId = req.user!.organizationId;
  await db.delete(sharedMemoriesTable)
    .where(and(eq(sharedMemoriesTable.id, Number(req.params.id)), eq(sharedMemoriesTable.organizationId, orgId)));
  res.json({ ok: true });
});

export default router;
