import { Router, type IRouter } from "express";
import { eq, asc, desc } from "drizzle-orm";
import {
  db,
  workflowsTable,
  workflowStepsTable,
  workflowRunsTable,
  workflowStepLogsTable,
  agentsTable,
  organizationsTable,
} from "@workspace/db";
import { runWorkflow } from "../lib/workflow-runner";
import { runPlannerAgent } from "../lib/planner-agent";
import { z } from "zod/v4";

const router: IRouter = Router();

const CreateWorkflowBody = z.object({
  organizationId: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().optional(),
});

const AddStepBody = z.object({
  agentId: z.number().int().positive(),
  name: z.string().min(1),
  instruction: z.string().min(1),
  order: z.number().int().min(0),
});

const RunWorkflowBody = z.object({
  input: z.string().min(1),
  usePlanner: z.boolean().optional().default(false),
});

router.get("/workflows", async (req, res): Promise<void> => {
  const orgId = req.query.organizationId ? parseInt(String(req.query.organizationId), 10) : null;

  let query = db
    .select({
      id: workflowsTable.id,
      organizationId: workflowsTable.organizationId,
      name: workflowsTable.name,
      description: workflowsTable.description,
      status: workflowsTable.status,
      createdAt: workflowsTable.createdAt,
      updatedAt: workflowsTable.updatedAt,
    })
    .from(workflowsTable)
    .$dynamic();

  if (orgId && !isNaN(orgId)) {
    query = query.where(eq(workflowsTable.organizationId, orgId));
  }

  const workflows = await query.orderBy(desc(workflowsTable.createdAt));
  res.json(workflows);
});

router.post("/workflows", async (req, res): Promise<void> => {
  const parsed = CreateWorkflowBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, parsed.data.organizationId));

  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  const [workflow] = await db
    .insert(workflowsTable)
    .values({
      organizationId: parsed.data.organizationId,
      name: parsed.data.name,
      description: parsed.data.description,
    })
    .returning();

  req.log.info({ workflowId: workflow.id }, "Workflow created");
  res.status(201).json(workflow);
});

router.get("/workflows/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid workflow id" });
    return;
  }

  const [workflow] = await db
    .select()
    .from(workflowsTable)
    .where(eq(workflowsTable.id, id));

  if (!workflow) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }

  const steps = await db
    .select({
      id: workflowStepsTable.id,
      workflowId: workflowStepsTable.workflowId,
      order: workflowStepsTable.order,
      agentId: workflowStepsTable.agentId,
      agentName: agentsTable.name,
      agentRole: agentsTable.role,
      name: workflowStepsTable.name,
      instruction: workflowStepsTable.instruction,
      createdAt: workflowStepsTable.createdAt,
    })
    .from(workflowStepsTable)
    .leftJoin(agentsTable, eq(workflowStepsTable.agentId, agentsTable.id))
    .where(eq(workflowStepsTable.workflowId, id))
    .orderBy(asc(workflowStepsTable.order));

  res.json({ ...workflow, steps });
});

router.post("/workflows/:id/steps", async (req, res): Promise<void> => {
  const workflowId = parseInt(req.params.id, 10);
  if (isNaN(workflowId)) {
    res.status(400).json({ error: "Invalid workflow id" });
    return;
  }

  const parsed = AddStepBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [workflow] = await db
    .select()
    .from(workflowsTable)
    .where(eq(workflowsTable.id, workflowId));

  if (!workflow) {
    res.status(404).json({ error: "Workflow not found" });
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

  const [step] = await db
    .insert(workflowStepsTable)
    .values({
      workflowId,
      agentId: parsed.data.agentId,
      order: parsed.data.order,
      name: parsed.data.name,
      instruction: parsed.data.instruction,
    })
    .returning();

  req.log.info({ workflowId, stepId: step.id }, "Workflow step added");
  res.status(201).json(step);
});

router.post("/workflows/:id/run", async (req, res): Promise<void> => {
  const workflowId = parseInt(req.params.id, 10);
  if (isNaN(workflowId)) {
    res.status(400).json({ error: "Invalid workflow id" });
    return;
  }

  const parsed = RunWorkflowBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [workflow] = await db
    .select()
    .from(workflowsTable)
    .where(eq(workflowsTable.id, workflowId));

  if (!workflow) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }

  req.log.info({ workflowId, usePlanner: parsed.data.usePlanner }, "Workflow run initiated");

  let plannerOutput = null;
  if (parsed.data.usePlanner) {
    try {
      plannerOutput = await runPlannerAgent(parsed.data.input);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Planner Agent failed: ${msg}` });
      return;
    }
  }

  const result = await runWorkflow(workflowId, parsed.data.input);

  res.json({
    ...result,
    plannerOutput,
  });
});

router.get("/workflows/:id/executions", async (req, res): Promise<void> => {
  const workflowId = parseInt(req.params.id, 10);
  if (isNaN(workflowId)) {
    res.status(400).json({ error: "Invalid workflow id" });
    return;
  }

  const runs = await db
    .select()
    .from(workflowRunsTable)
    .where(eq(workflowRunsTable.workflowId, workflowId))
    .orderBy(desc(workflowRunsTable.startedAt));

  const runsWithSteps = await Promise.all(
    runs.map(async (run) => {
      const stepLogs = await db
        .select({
          id: workflowStepLogsTable.id,
          stepName: workflowStepLogsTable.stepName,
          agentId: workflowStepLogsTable.agentId,
          agentName: agentsTable.name,
          stepOrder: workflowStepLogsTable.stepOrder,
          status: workflowStepLogsTable.status,
          input: workflowStepLogsTable.input,
          output: workflowStepLogsTable.output,
          errorMessage: workflowStepLogsTable.errorMessage,
          promptTokens: workflowStepLogsTable.promptTokens,
          completionTokens: workflowStepLogsTable.completionTokens,
          totalTokens: workflowStepLogsTable.totalTokens,
          estimatedCost: workflowStepLogsTable.estimatedCost,
          durationMs: workflowStepLogsTable.durationMs,
          startedAt: workflowStepLogsTable.startedAt,
          completedAt: workflowStepLogsTable.completedAt,
        })
        .from(workflowStepLogsTable)
        .leftJoin(agentsTable, eq(workflowStepLogsTable.agentId, agentsTable.id))
        .where(eq(workflowStepLogsTable.workflowRunId, run.id))
        .orderBy(asc(workflowStepLogsTable.stepOrder));

      return { ...run, stepLogs };
    }),
  );

  res.json(runsWithSteps);
});

router.get("/workflows/:id/executions/:runId", async (req, res): Promise<void> => {
  const runId = parseInt(req.params.runId, 10);
  if (isNaN(runId)) {
    res.status(400).json({ error: "Invalid run id" });
    return;
  }

  const [run] = await db
    .select()
    .from(workflowRunsTable)
    .where(eq(workflowRunsTable.id, runId));

  if (!run) {
    res.status(404).json({ error: "Workflow run not found" });
    return;
  }

  const stepLogs = await db
    .select({
      id: workflowStepLogsTable.id,
      stepName: workflowStepLogsTable.stepName,
      agentId: workflowStepLogsTable.agentId,
      agentName: agentsTable.name,
      stepOrder: workflowStepLogsTable.stepOrder,
      status: workflowStepLogsTable.status,
      input: workflowStepLogsTable.input,
      output: workflowStepLogsTable.output,
      errorMessage: workflowStepLogsTable.errorMessage,
      promptTokens: workflowStepLogsTable.promptTokens,
      completionTokens: workflowStepLogsTable.completionTokens,
      totalTokens: workflowStepLogsTable.totalTokens,
      estimatedCost: workflowStepLogsTable.estimatedCost,
      durationMs: workflowStepLogsTable.durationMs,
      startedAt: workflowStepLogsTable.startedAt,
      completedAt: workflowStepLogsTable.completedAt,
    })
    .from(workflowStepLogsTable)
    .leftJoin(agentsTable, eq(workflowStepLogsTable.agentId, agentsTable.id))
    .where(eq(workflowStepLogsTable.workflowRunId, runId))
    .orderBy(asc(workflowStepLogsTable.stepOrder));

  res.json({ ...run, stepLogs });
});

router.post("/workflows/planner/analyze", async (req, res): Promise<void> => {
  const { input } = req.body as { input?: string };
  if (!input) {
    res.status(400).json({ error: "input is required" });
    return;
  }

  try {
    const result = await runPlannerAgent(input);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
