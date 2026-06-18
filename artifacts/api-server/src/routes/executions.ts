import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, executionsTable, tasksTable, agentsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/executions", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const taskIdRaw = req.query.taskId;
  const agentIdRaw = req.query.agentId;

  let query = db
    .select()
    .from(executionsTable)
    .innerJoin(tasksTable, and(
      eq(executionsTable.taskId, tasksTable.id),
      eq(tasksTable.organizationId, orgId),
    ))
    .$dynamic();

  if (typeof taskIdRaw === "string") {
    const taskId = parseInt(taskIdRaw, 10);
    if (!isNaN(taskId)) {
      query = query.where(eq(executionsTable.taskId, taskId));
    }
  } else if (typeof agentIdRaw === "string") {
    const agentId = parseInt(agentIdRaw, 10);
    if (!isNaN(agentId)) {
      query = query.where(eq(executionsTable.agentId, agentId));
    }
  }

  const rows = await query.orderBy(desc(executionsTable.startedAt)).limit(100);
  res.json(rows.map((r: { executions: typeof executionsTable.$inferSelect }) => r.executions));
});

router.get("/executions/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const orgId = req.user!.organizationId;

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid execution id" });
    return;
  }

  const [row] = await db
    .select()
    .from(executionsTable)
    .innerJoin(tasksTable, and(
      eq(executionsTable.taskId, tasksTable.id),
      eq(tasksTable.organizationId, orgId),
    ))
    .where(eq(executionsTable.id, id));

  if (!row) {
    res.status(404).json({ error: "Execution not found" });
    return;
  }

  res.json(row.executions);
});

export default router;
