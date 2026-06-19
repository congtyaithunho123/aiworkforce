import { eq, isNull, and, asc, gte, sum, sql } from "drizzle-orm";
import {
  db,
  agentsTable,
  tasksTable,
  memoriesTable,
  executionsTable,
  organizationsTable,
} from "@workspace/db";
import { runCompletion, estimateCost, type ChatMessage } from "./ai-service";
import { maybeSummarizeMemories } from "./memory-summarizer";
import { logger } from "./logger";
import { eventBus } from "./events";
import { createNotification } from "../routes/notifications";

export type RunTaskResult = {
  taskId: number;
  executionId: number;
  status: "completed" | "failed";
  errorMessage?: string;
};

async function checkBudget(organizationId: number): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const [org] = await db.select({
      monthlyBudget: organizationsTable.monthlyBudget,
      budgetWarningThreshold: organizationsTable.budgetWarningThreshold,
      stopOnBudgetExceed: organizationsTable.stopOnBudgetExceed,
    }).from(organizationsTable).where(eq(organizationsTable.id, organizationId));

    if (!org || !org.monthlyBudget) return { allowed: true };

    // Get current month spend from executions
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [usage] = await db.select({ total: sum(executionsTable.estimatedCost) })
      .from(executionsTable)
      .where(and(
        eq(executionsTable.organizationId, organizationId),
        sql`${executionsTable.startedAt} >= ${monthStart}`,
      ));

    const spent = Number(usage?.total ?? 0);
    const budget = org.monthlyBudget;
    const pct = Math.round((spent / budget) * 100);

    // Fire warning notification
    if (pct >= org.budgetWarningThreshold && pct < 100) {
      eventBus.publish({ type: "budget_warning", organizationId, percentUsed: pct, spent, budget });
      await createNotification({
        organizationId,
        type: "quota_warning",
        title: "⚠️ Ngân sách AI sắp hết",
        message: `Đã dùng ${pct}% ngân sách tháng ($${spent.toFixed(2)} / $${budget.toFixed(2)})`,
      });
    }

    if (spent >= budget) {
      eventBus.publish({ type: "budget_exceeded", organizationId, spent, budget });
      if (org.stopOnBudgetExceed) {
        return { allowed: false, reason: `Budget exceeded: $${spent.toFixed(2)} / $${budget.toFixed(2)}` };
      }
    }

    return { allowed: true };
  } catch {
    return { allowed: true }; // never block on budget check error
  }
}

async function evaluateExecution(executionId: number, agentName: string, input: string, output: string): Promise<void> {
  try {
    const { runCompletion } = await import("./ai-service");
    const evalResult = await runCompletion([
      {
        role: "system",
        content: `Bạn là AI Evaluator. Đánh giá output của một AI agent theo 3 tiêu chí, mỗi tiêu chí từ 0-100.
Trả về JSON: {"qualityScore": number, "accuracyScore": number, "completenessScore": number, "note": "string ngắn"}`,
      },
      {
        role: "user",
        content: `Agent: ${agentName}\nInput: ${input.slice(0, 500)}\nOutput: ${output.slice(0, 800)}\n\nĐánh giá output này.`,
      },
    ], { model: "gpt-4o-mini", outputFormat: "json" });

    let scores: { qualityScore?: number; accuracyScore?: number; completenessScore?: number; note?: string } = {};
    try { scores = JSON.parse(evalResult.content); } catch { return; }

    await db.update(executionsTable).set({
      qualityScore: scores.qualityScore ?? null,
      accuracyScore: scores.accuracyScore ?? null,
      completenessScore: scores.completenessScore ?? null,
      evaluationNote: scores.note ?? null,
    }).where(eq(executionsTable.id, executionId));
  } catch {
    // Evaluation is best-effort — never block
  }
}

export async function runAgentTask(taskId: number): Promise<RunTaskResult> {
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
  if (!task) throw new Error(`Task ${taskId} not found`);

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, task.agentId));
  if (!agent) throw new Error(`Agent ${task.agentId} not found`);

  // Budget guard
  if (task.organizationId) {
    const { allowed, reason } = await checkBudget(task.organizationId);
    if (!allowed) {
      await db.update(tasksTable).set({ status: "failed", errorMessage: reason }).where(eq(tasksTable.id, taskId));
      return { taskId, executionId: -1, status: "failed", errorMessage: reason };
    }
  }

  await db.update(tasksTable).set({ status: "running" }).where(eq(tasksTable.id, taskId));

  const [execution] = await db.insert(executionsTable).values({
    organizationId: task.organizationId,
    taskId: task.id,
    agentId: agent.id,
    status: "running",
  }).returning();

  // Emit start event
  eventBus.publish({
    type: "task_started",
    taskId,
    agentId: agent.id,
    agentName: agent.name,
    input: task.input.slice(0, 200),
    organizationId: task.organizationId ?? 0,
  });

  logger.info({ taskId, agentId: agent.id, executionId: execution.id }, "Agent task started");

  await maybeSummarizeMemories(agent.id, task.organizationId ?? 0);

  const activeMemories = await db
    .select()
    .from(memoriesTable)
    .where(and(eq(memoriesTable.agentId, agent.id), isNull(memoriesTable.archivedAt)))
    .orderBy(asc(memoriesTable.createdAt))
    .limit(30);

  const messages: ChatMessage[] = [
    { role: "system", content: agent.systemPrompt },
    ...activeMemories.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
    { role: "user", content: task.input },
  ];

  eventBus.publish({
    type: "task_progress",
    taskId,
    executionId: execution.id,
    message: "Đang gọi LLM...",
    percent: 30,
    organizationId: task.organizationId ?? 0,
  });

  const startedAt = new Date();

  try {
    const aiResult = await runCompletion(messages, {
      model: agent.model,
      outputFormat: (agent.outputFormat as "text" | "json") ?? "text",
      outputSchema: agent.outputSchema,
    });

    const endedAt = new Date();
    const durationMs = endedAt.getTime() - startedAt.getTime();
    const cost = estimateCost(aiResult.model, aiResult.promptTokens, aiResult.completionTokens);

    await db.update(executionsTable).set({
      endedAt,
      promptTokens: aiResult.promptTokens,
      completionTokens: aiResult.completionTokens,
      totalTokens: aiResult.totalTokens,
      estimatedCost: cost,
      durationMs,
      status: "completed",
      output: aiResult.content,
    }).where(eq(executionsTable.id, execution.id));

    await db.update(tasksTable).set({ status: "completed", result: aiResult.content, executionMs: durationMs })
      .where(eq(tasksTable.id, taskId));

    await db.insert(memoriesTable).values([
      { agentId: agent.id, organizationId: task.organizationId ?? 0, taskId: task.id, role: "user", content: task.input },
      { agentId: agent.id, organizationId: task.organizationId ?? 0, taskId: task.id, role: "assistant", content: aiResult.content },
    ]);

    eventBus.publish({
      type: "task_completed",
      taskId,
      executionId: execution.id,
      durationMs,
      tokens: aiResult.totalTokens,
      cost,
      organizationId: task.organizationId ?? 0,
    });

    logger.info({ taskId, executionId: execution.id, durationMs, totalTokens: aiResult.totalTokens, cost }, "Task completed");

    // Async evaluation — fire and forget
    evaluateExecution(execution.id, agent.name, task.input, aiResult.content).catch(() => {});

    return { taskId, executionId: execution.id, status: "completed" };
  } catch (err) {
    const endedAt = new Date();
    const durationMs = endedAt.getTime() - startedAt.getTime();
    const errorMessage = err instanceof Error ? err.message : String(err);

    await db.update(executionsTable).set({ endedAt, durationMs, status: "failed", errorMessage })
      .where(eq(executionsTable.id, execution.id));
    await db.update(tasksTable).set({ status: "failed", errorMessage, executionMs: durationMs })
      .where(eq(tasksTable.id, taskId));

    eventBus.publish({
      type: "task_failed",
      taskId,
      executionId: execution.id,
      error: errorMessage,
      organizationId: task.organizationId ?? 0,
    });

    if (task.organizationId) {
      await createNotification({
        organizationId: task.organizationId,
        type: "task_failed",
        title: "❌ Task thất bại",
        message: `Agent ${agent.name} gặp lỗi: ${errorMessage.slice(0, 100)}`,
        resourceType: "task",
        resourceId: taskId,
      });
    }

    logger.error({ taskId, executionId: execution.id, errorMessage }, "Task failed");
    return { taskId, executionId: execution.id, status: "failed", errorMessage };
  }
}
