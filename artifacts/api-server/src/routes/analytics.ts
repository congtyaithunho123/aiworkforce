import { Router, type IRouter } from "express";
import { eq, desc, sum, count, avg, and } from "drizzle-orm";
import {
  db,
  executionsTable,
  tasksTable,
  agentsTable,
  workflowRunsTable,
  workflowsTable,
} from "@workspace/db";

const router: IRouter = Router();

router.get("/analytics/cost", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const [overall] = await db
    .select({
      totalCost: sum(executionsTable.estimatedCost),
      totalTokens: sum(executionsTable.totalTokens),
      totalPromptTokens: sum(executionsTable.promptTokens),
      totalCompletionTokens: sum(executionsTable.completionTokens),
      executionCount: count(executionsTable.id),
    })
    .from(executionsTable)
    .innerJoin(tasksTable, and(
      eq(executionsTable.taskId, tasksTable.id),
      eq(tasksTable.organizationId, orgId),
    ));

  const perAgent = await db
    .select({
      agentId: executionsTable.agentId,
      agentName: agentsTable.name,
      agentRole: agentsTable.role,
      totalCost: sum(executionsTable.estimatedCost),
      totalTokens: sum(executionsTable.totalTokens),
      executionCount: count(executionsTable.id),
    })
    .from(executionsTable)
    .innerJoin(tasksTable, and(
      eq(executionsTable.taskId, tasksTable.id),
      eq(tasksTable.organizationId, orgId),
    ))
    .leftJoin(agentsTable, eq(executionsTable.agentId, agentsTable.id))
    .groupBy(executionsTable.agentId, agentsTable.name, agentsTable.role)
    .orderBy(desc(sum(executionsTable.estimatedCost)));

  const workflowCosts = await db
    .select({
      workflowId: workflowRunsTable.workflowId,
      totalCost: sum(workflowRunsTable.totalCost),
      totalTokens: sum(workflowRunsTable.totalTokens),
      runCount: count(workflowRunsTable.id),
    })
    .from(workflowRunsTable)
    .innerJoin(workflowsTable, and(
      eq(workflowRunsTable.workflowId, workflowsTable.id),
      eq(workflowsTable.organizationId, orgId),
    ))
    .groupBy(workflowRunsTable.workflowId)
    .orderBy(desc(sum(workflowRunsTable.totalCost)));

  res.json({ overall, perAgent, workflowCosts });
});

router.get("/analytics/kpi", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const [taskStats] = await db
    .select({ totalTasks: count(tasksTable.id) })
    .from(tasksTable)
    .where(eq(tasksTable.organizationId, orgId));

  const [completedStats] = await db
    .select({ completedTasks: count(tasksTable.id) })
    .from(tasksTable)
    .where(and(eq(tasksTable.organizationId, orgId), eq(tasksTable.status, "completed")));

  const [failedStats] = await db
    .select({ failedTasks: count(tasksTable.id) })
    .from(tasksTable)
    .where(and(eq(tasksTable.organizationId, orgId), eq(tasksTable.status, "failed")));

  const [pendingApproval] = await db
    .select({ pendingApproval: count(tasksTable.id) })
    .from(tasksTable)
    .where(and(eq(tasksTable.organizationId, orgId), eq(tasksTable.approvalStatus, "pending")));

  const [execStats] = await db
    .select({
      avgDurationMs: avg(executionsTable.totalTokens),
      totalCost: sum(executionsTable.estimatedCost),
      totalExecutions: count(executionsTable.id),
    })
    .from(executionsTable)
    .innerJoin(tasksTable, and(
      eq(executionsTable.taskId, tasksTable.id),
      eq(tasksTable.organizationId, orgId),
    ));

  const agentPerformance = await db
    .select({
      agentId: agentsTable.id,
      agentName: agentsTable.name,
      agentRole: agentsTable.role,
      totalExecutions: count(executionsTable.id),
      totalCost: sum(executionsTable.estimatedCost),
      totalTokens: sum(executionsTable.totalTokens),
    })
    .from(agentsTable)
    .leftJoin(executionsTable, and(
      eq(executionsTable.agentId, agentsTable.id),
    ))
    .where(eq(agentsTable.organizationId, orgId))
    .groupBy(agentsTable.id, agentsTable.name, agentsTable.role)
    .orderBy(desc(count(executionsTable.id)));

  const total = Number(taskStats.totalTasks) || 0;
  const completed = Number(completedStats.completedTasks) || 0;
  const failed = Number(failedStats.failedTasks) || 0;
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const [workflowStats] = await db
    .select({ totalRuns: count(workflowRunsTable.id) })
    .from(workflowRunsTable)
    .innerJoin(workflowsTable, and(
      eq(workflowRunsTable.workflowId, workflowsTable.id),
      eq(workflowsTable.organizationId, orgId),
    ))
    .where(eq(workflowRunsTable.status, "completed"));

  res.json({
    tasks: { total, completed, failed, pending: total - completed - failed, successRate },
    approvals: { pendingApproval: Number(pendingApproval.pendingApproval) || 0 },
    executions: { total: Number(execStats.totalExecutions) || 0, totalCost: Number(execStats.totalCost) || 0 },
    workflows: { totalRuns: Number(workflowStats.totalRuns) || 0 },
    agentPerformance,
  });
});

export default router;
