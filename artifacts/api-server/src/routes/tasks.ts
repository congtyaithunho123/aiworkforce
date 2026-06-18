import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, tasksTable, agentsTable } from "@workspace/db";
import { CreateTaskBody } from "@workspace/api-zod";
import { z } from "zod/v4";

const router: IRouter = Router();

router.get("/tasks", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const status = req.query.status ? String(req.query.status) : null;
  const approvalStatus = req.query.approvalStatus ? String(req.query.approvalStatus) : null;

  let query = db
    .select({
      id: tasksTable.id,
      agentId: tasksTable.agentId,
      agentName: agentsTable.name,
      agentRole: agentsTable.role,
      organizationId: tasksTable.organizationId,
      input: tasksTable.input,
      status: tasksTable.status,
      result: tasksTable.result,
      errorMessage: tasksTable.errorMessage,
      executionMs: tasksTable.executionMs,
      requiresApproval: tasksTable.requiresApproval,
      approvalStatus: tasksTable.approvalStatus,
      approvalNote: tasksTable.approvalNote,
      reviewedAt: tasksTable.reviewedAt,
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt,
    })
    .from(tasksTable)
    .leftJoin(agentsTable, eq(tasksTable.agentId, agentsTable.id))
    .where(eq(tasksTable.organizationId, orgId))
    .$dynamic();

  if (status) {
    query = query.where(eq(tasksTable.status, status));
  }
  if (approvalStatus) {
    query = query.where(eq(tasksTable.approvalStatus, approvalStatus));
  }

  const tasks = await query.orderBy(desc(tasksTable.createdAt)).limit(50);
  res.json(tasks);
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const orgId = req.user!.organizationId;

  const [agent] = await db
    .select()
    .from(agentsTable)
    .where(and(eq(agentsTable.id, parsed.data.agentId), eq(agentsTable.organizationId, orgId)));

  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const requiresApproval = (req.body as { requiresApproval?: boolean }).requiresApproval === true;

  const [task] = await db
    .insert(tasksTable)
    .values({
      agentId: parsed.data.agentId,
      organizationId: orgId,
      input: parsed.data.input,
      status: "pending",
      requiresApproval,
    })
    .returning();

  req.log.info({ taskId: task.id, agentId: agent.id, requiresApproval }, "Task queued");
  res.status(201).json(task);
});

router.get("/tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const orgId = req.user!.organizationId;
  if (isNaN(id)) { res.status(400).json({ error: "Invalid task id" }); return; }

  const [task] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, id), eq(tasksTable.organizationId, orgId)));
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(task);
});

const ApprovalBody = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().optional(),
});

router.post("/tasks/:id/approve", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const orgId = req.user!.organizationId;
  if (isNaN(id)) { res.status(400).json({ error: "Invalid task id" }); return; }

  const parsed = ApprovalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [task] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, id), eq(tasksTable.organizationId, orgId)));
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  if (!task.requiresApproval) {
    res.status(400).json({ error: "Task does not require approval" });
    return;
  }

  const newStatus = parsed.data.action === "approve" ? "completed" : "failed";
  const [updated] = await db
    .update(tasksTable)
    .set({
      approvalStatus: parsed.data.action === "approve" ? "approved" : "rejected",
      approvalNote: parsed.data.note,
      reviewedAt: new Date(),
      status: newStatus,
    })
    .where(eq(tasksTable.id, id))
    .returning();

  req.log.info({ taskId: id, action: parsed.data.action }, "Task approval processed");
  res.json(updated);
});

export default router;
