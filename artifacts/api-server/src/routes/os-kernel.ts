import { Router } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  kernelAgentsTable,
  kernelWorkflowsTable,
  kernelTasksTable,
} from "@workspace/db";
import { emitEvent } from "./workforce-cloud";

const router = Router();

const WORKER_NODES = ["node-01", "node-02", "node-03", "node-04"];

function pickWorkerNode(priority: number): string {
  const idx = Math.floor(Math.random() * WORKER_NODES.length);
  return WORKER_NODES[idx];
}

function calcNextRun(cron: string): Date {
  const now = new Date();
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return new Date(Date.now() + 60_000);
  const [min, hour] = parts;
  const next = new Date(now);
  next.setSeconds(0, 0);
  if (hour !== "*") next.setHours(parseInt(hour, 10));
  if (min !== "*") next.setMinutes(parseInt(min, 10));
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

async function auditLog(
  orgId: number,
  actor: string,
  action: string,
  resource: string,
  resourceId?: string,
  before?: unknown,
  after?: unknown,
) {
  try {
    const { osAuditLogsTable } = await import("@workspace/db");
    await db.insert(osAuditLogsTable).values({
      organizationId: orgId,
      actor,
      actorType: "user",
      action,
      resource,
      resourceId,
      severity: "info",
      status: "success",
      before: before as Record<string, unknown> | undefined,
      after: after as Record<string, unknown> | undefined,
    });
  } catch { /* best-effort */ }
}

// ─── WorkforceKernel: Agent Lifecycle ─────────────────────────────────────────

router.get("/api/os/kernel/agents", async (req, res) => {
  const orgId = req.user!.organizationId;
  const agents = await db
    .select()
    .from(kernelAgentsTable)
    .where(eq(kernelAgentsTable.organizationId, orgId))
    .orderBy(desc(kernelAgentsTable.updatedAt));
  res.json({ agents });
});

router.post("/api/os/kernel/agents", async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    agentType: z.string().default("generic"),
    priority: z.number().int().min(1).max(10).default(5),
    maxRetries: z.number().int().default(3),
    capabilities: z.array(z.string()).default([]),
    config: z.record(z.unknown()).default({}),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const orgId = req.user!.organizationId;
  const [agent] = await db.insert(kernelAgentsTable).values({
    organizationId: orgId,
    ...parsed.data,
    status: "CREATED",
  }).returning();
  await auditLog(orgId, req.user!.email ?? "system", "kernel.agent.create", "kernel_agent", String(agent.id), null, agent);
  await emitEvent(orgId, "KERNEL_AGENT_CREATED", { agentId: agent.id, name: agent.name }, { message: `Agent ${agent.name} created` });
  res.status(201).json({ agent });
});

router.patch("/api/os/kernel/agents/:id/status", async (req, res) => {
  const schema = z.object({
    status: z.enum(["CREATED", "READY", "RUNNING", "PAUSED", "FAILED", "TERMINATED"]),
    errorMessage: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const orgId = req.user!.organizationId;
  const agentId = Number(req.params.id);
  const [existing] = await db.select().from(kernelAgentsTable).where(
    and(eq(kernelAgentsTable.id, agentId), eq(kernelAgentsTable.organizationId, orgId))
  );
  if (!existing) return res.status(404).json({ error: "Agent not found" });

  const now = new Date();
  const update: Partial<typeof kernelAgentsTable.$inferInsert> = {
    status: parsed.data.status,
    updatedAt: now,
    errorMessage: parsed.data.errorMessage,
  };
  if (parsed.data.status === "RUNNING") {
    update.startedAt = now;
    update.workerNode = pickWorkerNode(existing.priority);
    update.lastHeartbeat = now;
  }
  if (parsed.data.status === "PAUSED") update.pausedAt = now;
  if (parsed.data.status === "TERMINATED") update.terminatedAt = now;

  const [agent] = await db.update(kernelAgentsTable).set(update)
    .where(and(eq(kernelAgentsTable.id, agentId), eq(kernelAgentsTable.organizationId, orgId)))
    .returning();
  await auditLog(orgId, req.user!.email ?? "system", `kernel.agent.${parsed.data.status.toLowerCase()}`, "kernel_agent", String(agentId), { status: existing.status }, { status: parsed.data.status });
  await emitEvent(orgId, `KERNEL_AGENT_${parsed.data.status}`, { agentId, name: existing.name }, { message: `Agent ${existing.name} → ${parsed.data.status}` });
  res.json({ agent });
});

router.delete("/api/os/kernel/agents/:id", async (req, res) => {
  const orgId = req.user!.organizationId;
  const agentId = Number(req.params.id);
  await db.update(kernelAgentsTable).set({ status: "TERMINATED", terminatedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(kernelAgentsTable.id, agentId), eq(kernelAgentsTable.organizationId, orgId)));
  await auditLog(orgId, req.user!.email ?? "system", "kernel.agent.terminate", "kernel_agent", String(agentId));
  res.json({ success: true });
});

// ─── AgentScheduler: distribute + load-balance ────────────────────────────────

router.get("/api/os/scheduler/status", async (req, res) => {
  const orgId = req.user!.organizationId;
  const agents = await db.select().from(kernelAgentsTable).where(eq(kernelAgentsTable.organizationId, orgId));
  const tasks = await db.select().from(kernelTasksTable).where(eq(kernelTasksTable.organizationId, orgId));

  const nodeLoad: Record<string, number> = {};
  WORKER_NODES.forEach(n => { nodeLoad[n] = 0; });
  agents.filter(a => a.status === "RUNNING").forEach(a => {
    if (a.workerNode && nodeLoad[a.workerNode] !== undefined) nodeLoad[a.workerNode]++;
  });

  const queue = tasks.filter(t => t.status === "queued").length;
  const running = tasks.filter(t => t.status === "running").length;
  const completed = tasks.filter(t => t.status === "completed").length;
  const failed = tasks.filter(t => t.status === "failed").length;

  res.json({
    nodes: WORKER_NODES.map(name => ({
      name,
      load: nodeLoad[name] ?? 0,
      capacity: 10,
      utilization: ((nodeLoad[name] ?? 0) / 10) * 100,
    })),
    queue: { queued: queue, running, completed, failed, total: tasks.length },
    agents: {
      total: agents.length,
      byStatus: {
        CREATED: agents.filter(a => a.status === "CREATED").length,
        READY: agents.filter(a => a.status === "READY").length,
        RUNNING: agents.filter(a => a.status === "RUNNING").length,
        PAUSED: agents.filter(a => a.status === "PAUSED").length,
        FAILED: agents.filter(a => a.status === "FAILED").length,
        TERMINATED: agents.filter(a => a.status === "TERMINATED").length,
      },
    },
  });
});

router.post("/api/os/scheduler/dispatch", async (req, res) => {
  const schema = z.object({
    agentId: z.number(),
    priority: z.number().int().min(1).max(10).default(5),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const orgId = req.user!.organizationId;

  const [agent] = await db.select().from(kernelAgentsTable).where(
    and(eq(kernelAgentsTable.id, parsed.data.agentId), eq(kernelAgentsTable.organizationId, orgId))
  );
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  const workerNode = pickWorkerNode(parsed.data.priority);
  const [updated] = await db.update(kernelAgentsTable).set({
    status: "RUNNING",
    workerNode,
    priority: parsed.data.priority,
    startedAt: new Date(),
    lastHeartbeat: new Date(),
    updatedAt: new Date(),
  }).where(and(eq(kernelAgentsTable.id, parsed.data.agentId), eq(kernelAgentsTable.organizationId, orgId))).returning();

  await emitEvent(orgId, "AGENT_DISPATCHED", { agentId: agent.id, workerNode }, { message: `Agent ${agent.name} dispatched to ${workerNode}` });
  res.json({ agent: updated, workerNode });
});

// ─── WorkflowScheduler ────────────────────────────────────────────────────────

router.get("/api/os/workflows", async (req, res) => {
  const orgId = req.user!.organizationId;
  const workflows = await db.select().from(kernelWorkflowsTable)
    .where(eq(kernelWorkflowsTable.organizationId, orgId))
    .orderBy(desc(kernelWorkflowsTable.updatedAt));
  res.json({ workflows });
});

router.post("/api/os/workflows", async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    scheduleType: z.enum(["immediate", "cron", "event"]).default("immediate"),
    cronExpression: z.string().optional(),
    eventTrigger: z.string().optional(),
    steps: z.array(z.record(z.unknown())).default([]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const orgId = req.user!.organizationId;

  const nextRunAt = parsed.data.scheduleType === "cron" && parsed.data.cronExpression
    ? calcNextRun(parsed.data.cronExpression) : undefined;

  const [wf] = await db.insert(kernelWorkflowsTable).values({
    organizationId: orgId,
    ...parsed.data,
    nextRunAt,
  }).returning();
  await auditLog(orgId, req.user!.email ?? "system", "kernel.workflow.create", "kernel_workflow", String(wf.id), null, wf);
  res.status(201).json({ workflow: wf });
});

router.post("/api/os/workflows/:id/run", async (req, res) => {
  const orgId = req.user!.organizationId;
  const wfId = Number(req.params.id);
  const [wf] = await db.select().from(kernelWorkflowsTable).where(
    and(eq(kernelWorkflowsTable.id, wfId), eq(kernelWorkflowsTable.organizationId, orgId))
  );
  if (!wf) return res.status(404).json({ error: "Workflow not found" });

  const [task] = await db.insert(kernelTasksTable).values({
    organizationId: orgId,
    workflowId: wfId,
    name: `Run: ${wf.name}`,
    type: "workflow",
    status: "running",
    priority: 5,
    input: { workflowId: wfId, triggeredAt: new Date().toISOString() },
    startedAt: new Date(),
  }).returning();

  const completedAt = new Date(Date.now() + Math.floor(Math.random() * 3000) + 500);
  await db.update(kernelTasksTable).set({
    status: "completed",
    completedAt,
    durationMs: Math.floor(Math.random() * 3000) + 500,
    output: { steps_completed: wf.steps.length || 3, result: "success" },
  }).where(eq(kernelTasksTable.id, task.id));

  await db.update(kernelWorkflowsTable).set({
    lastRunAt: new Date(),
    runCount: sql`${kernelWorkflowsTable.runCount} + 1`,
    successCount: sql`${kernelWorkflowsTable.successCount} + 1`,
    updatedAt: new Date(),
  }).where(eq(kernelWorkflowsTable.id, wfId));

  await emitEvent(orgId, "WORKFLOW_RUN_COMPLETED", { workflowId: wfId, taskId: task.id }, { message: `Workflow "${wf.name}" completed` });
  res.json({ task: { ...task, status: "completed", durationMs: task.durationMs } });
});

router.delete("/api/os/workflows/:id", async (req, res) => {
  const orgId = req.user!.organizationId;
  await db.delete(kernelWorkflowsTable).where(
    and(eq(kernelWorkflowsTable.id, Number(req.params.id)), eq(kernelWorkflowsTable.organizationId, orgId))
  );
  res.json({ success: true });
});

// ─── Task Execution ───────────────────────────────────────────────────────────

router.get("/api/os/tasks", async (req, res) => {
  const orgId = req.user!.organizationId;
  const tasks = await db.select().from(kernelTasksTable)
    .where(eq(kernelTasksTable.organizationId, orgId))
    .orderBy(desc(kernelTasksTable.createdAt))
    .limit(100);
  res.json({ tasks });
});

router.post("/api/os/tasks", async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    type: z.string().default("generic"),
    priority: z.number().int().min(1).max(10).default(5),
    agentId: z.number().optional(),
    input: z.record(z.unknown()).default({}),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const orgId = req.user!.organizationId;

  const [task] = await db.insert(kernelTasksTable).values({
    organizationId: orgId,
    ...parsed.data,
    status: "queued",
  }).returning();

  setTimeout(async () => {
    const success = Math.random() > 0.1;
    await db.update(kernelTasksTable).set({
      status: success ? "completed" : "failed",
      completedAt: new Date(),
      durationMs: Math.floor(Math.random() * 5000) + 200,
      output: success ? { result: "Task completed successfully", data: {} } : null,
      errorMessage: success ? null : "Simulated task failure",
    }).where(eq(kernelTasksTable.id, task.id));
  }, Math.random() * 2000 + 500);

  res.status(201).json({ task });
});

router.get("/api/os/tasks/:id", async (req, res) => {
  const orgId = req.user!.organizationId;
  const [task] = await db.select().from(kernelTasksTable).where(
    and(eq(kernelTasksTable.id, Number(req.params.id)), eq(kernelTasksTable.organizationId, orgId))
  );
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json({ task });
});

export default router;
