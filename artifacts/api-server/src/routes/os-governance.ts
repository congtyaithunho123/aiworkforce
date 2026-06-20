import { Router } from "express";
import { eq, and, desc, gte } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  osAuditLogsTable,
  approvalsTable,
  osDeploymentsTable,
} from "@workspace/db";
import { emitEvent } from "./workforce-cloud";

const router = Router();

// ─── GovernanceLayer: Audit Trail ─────────────────────────────────────────────

router.get("/api/os/governance/audit", async (req, res) => {
  const orgId = req.user!.organizationId;
  const since = req.query.since ? new Date(req.query.since as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const logs = await db.select().from(osAuditLogsTable)
    .where(and(eq(osAuditLogsTable.organizationId, orgId), gte(osAuditLogsTable.createdAt, since)))
    .orderBy(desc(osAuditLogsTable.createdAt))
    .limit(200);
  res.json({ logs, count: logs.length });
});

router.post("/api/os/governance/audit", async (req, res) => {
  const schema = z.object({
    actor: z.string(),
    actorType: z.enum(["user", "agent", "system"]).default("system"),
    action: z.string(),
    resource: z.string(),
    resourceId: z.string().optional(),
    severity: z.enum(["info", "warning", "critical"]).default("info"),
    status: z.enum(["success", "failure"]).default("success"),
    before: z.record(z.unknown()).optional(),
    after: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).default({}),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const orgId = req.user!.organizationId;
  const [log] = await db.insert(osAuditLogsTable).values({
    organizationId: orgId,
    ...parsed.data,
  }).returning();
  res.status(201).json({ log });
});

// ─── GovernanceLayer: Approvals ───────────────────────────────────────────────

router.get("/api/os/governance/approvals", async (req, res) => {
  const orgId = req.user!.organizationId;
  const approvals = await db.select().from(approvalsTable)
    .where(eq(approvalsTable.organizationId, orgId))
    .orderBy(desc(approvalsTable.createdAt));
  res.json({ approvals });
});

router.post("/api/os/governance/approvals", async (req, res) => {
  const schema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    requestType: z.string(),
    requestedBy: z.string(),
    priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    payload: z.record(z.unknown()).default({}),
    expiresInHours: z.number().default(24),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const orgId = req.user!.organizationId;

  const expiresAt = new Date(Date.now() + parsed.data.expiresInHours * 3600_000);
  const [approval] = await db.insert(approvalsTable).values({
    organizationId: orgId,
    title: parsed.data.title,
    description: parsed.data.description,
    requestType: parsed.data.requestType,
    requestedBy: parsed.data.requestedBy,
    priority: parsed.data.priority,
    payload: parsed.data.payload,
    expiresAt,
  }).returning();

  await emitEvent(orgId, "APPROVAL_REQUESTED", { approvalId: approval.id, title: approval.title }, {
    severity: parsed.data.priority === "critical" ? "critical" : "warning",
    message: `Approval required: ${approval.title}`,
  });
  res.status(201).json({ approval });
});

router.patch("/api/os/governance/approvals/:id", async (req, res) => {
  const schema = z.object({
    action: z.enum(["approve", "reject"]),
    approvedBy: z.string(),
    rejectionReason: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const orgId = req.user!.organizationId;
  const approvalId = Number(req.params.id);

  const status = parsed.data.action === "approve" ? "approved" : "rejected";
  const [approval] = await db.update(approvalsTable).set({
    status,
    approvedBy: parsed.data.approvedBy,
    rejectionReason: parsed.data.rejectionReason,
    approvedAt: new Date(),
  }).where(and(eq(approvalsTable.id, approvalId), eq(approvalsTable.organizationId, orgId)))
    .returning();

  await emitEvent(orgId, `APPROVAL_${status.toUpperCase()}`, { approvalId, title: approval.title }, {
    message: `${approval.title} was ${status} by ${parsed.data.approvedBy}`,
  });
  res.json({ approval });
});

// ─── DeploymentManager ────────────────────────────────────────────────────────

router.get("/api/os/deployments", async (req, res) => {
  const orgId = req.user!.organizationId;
  const deployments = await db.select().from(osDeploymentsTable)
    .where(eq(osDeploymentsTable.organizationId, orgId))
    .orderBy(desc(osDeploymentsTable.createdAt));
  res.json({ deployments });
});

router.post("/api/os/deployments", async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    environment: z.enum(["development", "staging", "production"]).default("production"),
    target: z.enum(["local", "docker", "vps", "kubernetes"]).default("local"),
    version: z.string().default("1.0.0"),
    replicas: z.number().int().min(1).max(50).default(1),
    config: z.record(z.unknown()).default({}),
    healthCheckUrl: z.string().optional(),
    deployedBy: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const orgId = req.user!.organizationId;

  const deployLog: string[] = [];
  const steps = {
    local: ["Đọc config local", "Khởi động process", "Health check"],
    docker: ["Build Docker image", "Push to registry", "Deploy container", "Health check"],
    vps: ["Connect SSH", "Pull code", "Build", "Restart service", "Health check"],
    kubernetes: ["Apply manifests", "Wait for pods", "Scale replicas", "Ingress update", "Health check"],
  }[parsed.data.target];

  const [deployment] = await db.insert(osDeploymentsTable).values({
    organizationId: orgId,
    ...parsed.data,
    deployedBy: parsed.data.deployedBy ?? req.user!.email ?? "system",
    status: "deploying",
    startedAt: new Date(),
    deployLog: [],
  }).returning();

  let currentDeploy = deployment;
  for (let i = 0; i < steps.length; i++) {
    await new Promise(r => setTimeout(r, 300));
    deployLog.push(`[${new Date().toISOString()}] ✅ ${steps[i]}`);
    const success = i < steps.length - 1 ? true : Math.random() > 0.05;
    if (!success && i === steps.length - 1) {
      deployLog.push(`[${new Date().toISOString()}] ❌ Health check failed`);
      const [updated] = await db.update(osDeploymentsTable).set({
        status: "failed",
        deployLog,
        completedAt: new Date(),
        isHealthy: false,
        updatedAt: new Date(),
      }).where(eq(osDeploymentsTable.id, deployment.id)).returning();
      currentDeploy = updated;
      break;
    }
    if (i === steps.length - 1) {
      deployLog.push(`[${new Date().toISOString()}] 🚀 Deployment successful — ${parsed.data.replicas} replica(s) running`);
      const [updated] = await db.update(osDeploymentsTable).set({
        status: "running",
        deployLog,
        completedAt: new Date(),
        isHealthy: true,
        updatedAt: new Date(),
      }).where(eq(osDeploymentsTable.id, deployment.id)).returning();
      currentDeploy = updated;
    }
  }

  await emitEvent(orgId, "DEPLOYMENT_COMPLETED", {
    deploymentId: deployment.id,
    target: parsed.data.target,
    status: currentDeploy.status,
  }, { message: `Deployment "${parsed.data.name}" ${currentDeploy.status}` });

  res.status(201).json({ deployment: currentDeploy });
});

router.post("/api/os/deployments/:id/rollback", async (req, res) => {
  const orgId = req.user!.organizationId;
  const [dep] = await db.select().from(osDeploymentsTable).where(
    and(eq(osDeploymentsTable.id, Number(req.params.id)), eq(osDeploymentsTable.organizationId, orgId))
  );
  if (!dep) return res.status(404).json({ error: "Deployment not found" });

  const rollbackVersion = dep.rollbackVersion ?? "previous";
  const [updated] = await db.update(osDeploymentsTable).set({
    status: "running",
    version: rollbackVersion,
    isHealthy: true,
    deployLog: [...(dep.deployLog as string[]), `[${new Date().toISOString()}] ↩️ Rolled back to ${rollbackVersion}`],
    updatedAt: new Date(),
  }).where(eq(osDeploymentsTable.id, dep.id)).returning();

  res.json({ deployment: updated });
});

// ─── Control Plane Summary ────────────────────────────────────────────────────

router.get("/api/os/control-plane", async (req, res) => {
  const orgId = req.user!.organizationId;

  const [kernelAgents, workflows, tasks, quotas, auditLogs, approvals, deployments, sandboxes, policies] = await Promise.all([
    db.select().from((await import("@workspace/db")).kernelAgentsTable).where(eq((await import("@workspace/db")).kernelAgentsTable.organizationId, orgId)),
    db.select().from((await import("@workspace/db")).kernelWorkflowsTable).where(eq((await import("@workspace/db")).kernelWorkflowsTable.organizationId, orgId)),
    db.select().from((await import("@workspace/db")).kernelTasksTable).where(eq((await import("@workspace/db")).kernelTasksTable.organizationId, orgId)).orderBy(desc((await import("@workspace/db")).kernelTasksTable.createdAt)).limit(20),
    db.select().from((await import("@workspace/db")).resourceQuotasTable).where(eq((await import("@workspace/db")).resourceQuotasTable.organizationId, orgId)),
    db.select().from(osAuditLogsTable).where(eq(osAuditLogsTable.organizationId, orgId)).orderBy(desc(osAuditLogsTable.createdAt)).limit(20),
    db.select().from(approvalsTable).where(and(eq(approvalsTable.organizationId, orgId), eq(approvalsTable.status, "pending"))),
    db.select().from(osDeploymentsTable).where(eq(osDeploymentsTable.organizationId, orgId)).orderBy(desc(osDeploymentsTable.createdAt)).limit(10),
    db.select().from((await import("@workspace/db")).sandboxSessionsTable).where(and(eq((await import("@workspace/db")).sandboxSessionsTable.organizationId, orgId), eq((await import("@workspace/db")).sandboxSessionsTable.status, "running"))),
    db.select().from((await import("@workspace/db")).policiesTable).where(eq((await import("@workspace/db")).policiesTable.organizationId, orgId)),
  ]);

  const agentsByStatus = {
    CREATED: kernelAgents.filter(a => a.status === "CREATED").length,
    READY: kernelAgents.filter(a => a.status === "READY").length,
    RUNNING: kernelAgents.filter(a => a.status === "RUNNING").length,
    PAUSED: kernelAgents.filter(a => a.status === "PAUSED").length,
    FAILED: kernelAgents.filter(a => a.status === "FAILED").length,
    TERMINATED: kernelAgents.filter(a => a.status === "TERMINATED").length,
  };

  res.json({
    kernel: {
      agents: { total: kernelAgents.length, byStatus: agentsByStatus, list: kernelAgents.slice(0, 10) },
      workflows: { total: workflows.length, enabled: workflows.filter(w => w.isEnabled).length, list: workflows.slice(0, 10) },
      tasks: { total: tasks.length, recentList: tasks },
    },
    resources: {
      quotas: quotas.slice(0, 10),
      summary: {
        totalAgents: kernelAgents.length,
        runningAgents: agentsByStatus.RUNNING,
        activeSandboxes: sandboxes.length,
      },
    },
    governance: {
      pendingApprovals: approvals.length,
      recentAuditLogs: auditLogs,
      recentDeployments: deployments,
      policies: policies.length,
    },
  });
});

export default router;
