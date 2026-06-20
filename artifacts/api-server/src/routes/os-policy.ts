import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  policiesTable,
  sandboxSessionsTable,
  kernelAgentsTable,
} from "@workspace/db";
import { emitEvent } from "./workforce-cloud";

const router = Router();

const PRESET_POLICIES = [
  {
    name: "Sales Agent Policy",
    role: "sales_agent",
    effect: "allow",
    resources: ["crm", "leads", "email"],
    actions: ["read", "write", "send"],
    conditions: { maxCostPerCall: 0.1, allowedHours: "0-23" },
  },
  {
    name: "Support Agent Policy",
    role: "support_agent",
    effect: "allow",
    resources: ["tickets", "knowledge_base"],
    actions: ["read", "update"],
    conditions: { maxCostPerCall: 0.05 },
  },
  {
    name: "Finance Block Policy",
    role: "sales_agent",
    effect: "deny",
    resources: ["billing", "invoices", "financial_reports"],
    actions: ["read", "write", "delete"],
    conditions: {},
  },
];

// ─── PolicyEngine: Policies ───────────────────────────────────────────────────

router.get("/api/os/policies", async (req, res) => {
  const orgId = req.user!.organizationId;
  const policies = await db.select().from(policiesTable)
    .where(eq(policiesTable.organizationId, orgId))
    .orderBy(desc(policiesTable.priority), desc(policiesTable.createdAt));
  res.json({ policies });
});

router.post("/api/os/policies", async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    role: z.string(),
    effect: z.enum(["allow", "deny"]).default("allow"),
    resources: z.array(z.string()).default([]),
    actions: z.array(z.string()).default([]),
    conditions: z.record(z.unknown()).default({}),
    priority: z.number().int().default(10),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const orgId = req.user!.organizationId;

  const [policy] = await db.insert(policiesTable).values({
    organizationId: orgId,
    ...parsed.data,
  }).returning();
  res.status(201).json({ policy });
});

router.post("/api/os/policies/seed", async (req, res) => {
  const orgId = req.user!.organizationId;
  const existing = await db.select().from(policiesTable).where(eq(policiesTable.organizationId, orgId));
  if (existing.length > 0) return res.json({ message: "Policies already seeded", count: existing.length });

  const policies = await db.insert(policiesTable).values(
    PRESET_POLICIES.map(p => ({ organizationId: orgId, ...p }))
  ).returning();
  res.json({ policies, seeded: policies.length });
});

router.post("/api/os/policies/evaluate", async (req, res) => {
  const schema = z.object({
    role: z.string(),
    resource: z.string(),
    action: z.string(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const orgId = req.user!.organizationId;

  const policies = await db.select().from(policiesTable).where(
    and(eq(policiesTable.organizationId, orgId), eq(policiesTable.isActive, true))
  );

  const matching = policies.filter(p => {
    const roleMatch = p.role === parsed.data.role || p.role === "*";
    const resourceMatch = (p.resources as string[]).includes(parsed.data.resource) || (p.resources as string[]).includes("*");
    const actionMatch = (p.actions as string[]).includes(parsed.data.action) || (p.actions as string[]).includes("*");
    return roleMatch && resourceMatch && actionMatch;
  }).sort((a, b) => b.priority - a.priority);

  const denyPolicy = matching.find(p => p.effect === "deny");
  if (denyPolicy) {
    return res.json({ allowed: false, reason: `Denied by policy: ${denyPolicy.name}`, policy: denyPolicy });
  }
  const allowPolicy = matching.find(p => p.effect === "allow");
  if (allowPolicy) {
    return res.json({ allowed: true, reason: `Allowed by policy: ${allowPolicy.name}`, policy: allowPolicy });
  }
  res.json({ allowed: false, reason: "No matching policy — default deny", policy: null });
});

router.patch("/api/os/policies/:id", async (req, res) => {
  const schema = z.object({ isActive: z.boolean().optional(), priority: z.number().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const orgId = req.user!.organizationId;
  const [policy] = await db.update(policiesTable).set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(policiesTable.id, Number(req.params.id)), eq(policiesTable.organizationId, orgId)))
    .returning();
  res.json({ policy });
});

router.delete("/api/os/policies/:id", async (req, res) => {
  const orgId = req.user!.organizationId;
  await db.delete(policiesTable).where(
    and(eq(policiesTable.id, Number(req.params.id)), eq(policiesTable.organizationId, orgId))
  );
  res.json({ success: true });
});

// ─── ExecutionSandbox ─────────────────────────────────────────────────────────

router.get("/api/os/sandbox", async (req, res) => {
  const orgId = req.user!.organizationId;
  const sessions = await db.select().from(sandboxSessionsTable)
    .where(eq(sandboxSessionsTable.organizationId, orgId))
    .orderBy(desc(sandboxSessionsTable.createdAt))
    .limit(50);
  res.json({ sessions });
});

router.post("/api/os/sandbox/launch", async (req, res) => {
  const schema = z.object({
    agentId: z.number().optional(),
    agentName: z.string().optional(),
    allowedTools: z.array(z.string()).default(["search", "email"]),
    allowedResources: z.array(z.string()).default(["crm", "knowledge_base"]),
    networkAccess: z.boolean().default(false),
    memoryAccess: z.boolean().default(true),
    memoryNamespace: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const orgId = req.user!.organizationId;

  let agentName = parsed.data.agentName;
  if (parsed.data.agentId && !agentName) {
    const [ag] = await db.select().from(kernelAgentsTable).where(eq(kernelAgentsTable.id, parsed.data.agentId));
    agentName = ag?.name;
  }

  const [session] = await db.insert(sandboxSessionsTable).values({
    organizationId: orgId,
    agentId: parsed.data.agentId,
    agentName,
    allowedTools: parsed.data.allowedTools,
    allowedResources: parsed.data.allowedResources,
    networkAccess: parsed.data.networkAccess,
    memoryAccess: parsed.data.memoryAccess,
    memoryNamespace: parsed.data.memoryNamespace ?? `ns-${orgId}-${Date.now()}`,
    status: "running",
    startedAt: new Date(),
  }).returning();

  await emitEvent(orgId, "SANDBOX_LAUNCHED", { sessionId: session.id, agentName }, { message: `Sandbox launched for ${agentName ?? "anonymous"}` });
  res.status(201).json({ session });
});

router.post("/api/os/sandbox/:id/terminate", async (req, res) => {
  const orgId = req.user!.organizationId;
  const [session] = await db.update(sandboxSessionsTable)
    .set({ status: "terminated", terminatedAt: new Date() })
    .where(and(eq(sandboxSessionsTable.id, Number(req.params.id)), eq(sandboxSessionsTable.organizationId, orgId)))
    .returning();
  res.json({ session });
});

export default router;
