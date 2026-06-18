import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tasksTable, agentsTable } from "@workspace/db";
import { CreateTaskBody } from "@workspace/api-zod";
import { runAgentTask } from "../lib/agent-runner";

const router: IRouter = Router();

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [agent] = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.id, parsed.data.agentId));

  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const [task] = await db
    .insert(tasksTable)
    .values({
      agentId: parsed.data.agentId,
      organizationId: parsed.data.organizationId,
      input: parsed.data.input,
      status: "pending",
    })
    .returning();

  req.log.info({ taskId: task.id, agentId: agent.id }, "Task created, running agent");

  const runResult = await runAgentTask(task.id);

  const [updatedTask] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, task.id));

  res.status(201).json(updatedTask ?? { ...task, ...runResult });
});

router.get("/tasks/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid task id" });
    return;
  }

  const [task] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, id));

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(task);
});

export default router;
