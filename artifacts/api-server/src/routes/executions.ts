import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, executionsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/executions", async (req, res): Promise<void> => {
  const taskIdRaw = req.query.taskId;
  const agentIdRaw = req.query.agentId;

  let query = db.select().from(executionsTable).$dynamic();

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

  const executions = await query.orderBy(desc(executionsTable.startedAt)).limit(100);
  res.json(executions);
});

router.get("/executions/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid execution id" });
    return;
  }

  const [execution] = await db
    .select()
    .from(executionsTable)
    .where(eq(executionsTable.id, id));

  if (!execution) {
    res.status(404).json({ error: "Execution not found" });
    return;
  }

  res.json(execution);
});

export default router;
