import { eq, isNull, and, asc } from "drizzle-orm";
import {
  db,
  agentsTable,
  tasksTable,
  memoriesTable,
  executionsTable,
} from "@workspace/db";
import { runCompletion, estimateCost, type ChatMessage } from "./ai-service";
import { maybeSummarizeMemories } from "./memory-summarizer";
import { logger } from "./logger";

export type RunTaskResult = {
  taskId: number;
  executionId: number;
  status: "completed" | "failed";
  errorMessage?: string;
};

export async function runAgentTask(taskId: number): Promise<RunTaskResult> {
  const [task] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, taskId));

  if (!task) throw new Error(`Task ${taskId} not found`);

  const [agent] = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.id, task.agentId));

  if (!agent) throw new Error(`Agent ${task.agentId} not found`);

  await db
    .update(tasksTable)
    .set({ status: "running" })
    .where(eq(tasksTable.id, taskId));

  const [execution] = await db
    .insert(executionsTable)
    .values({
      taskId: task.id,
      agentId: agent.id,
      status: "running",
    })
    .returning();

  logger.info(
    { taskId, agentId: agent.id, executionId: execution.id },
    "Agent task started",
  );

  await maybeSummarizeMemories(agent.id, task.organizationId);

  const activeMemories = await db
    .select()
    .from(memoriesTable)
    .where(
      and(
        eq(memoriesTable.agentId, agent.id),
        isNull(memoriesTable.archivedAt),
      ),
    )
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

  const startedAt = new Date();

  try {
    const aiResult = await runCompletion(messages, {
      model: agent.model,
      outputFormat: (agent.outputFormat as "text" | "json") ?? "text",
      outputSchema: agent.outputSchema,
    });

    const endedAt = new Date();
    const executionMs = endedAt.getTime() - startedAt.getTime();
    const cost = estimateCost(
      aiResult.model,
      aiResult.promptTokens,
      aiResult.completionTokens,
    );

    await db
      .update(executionsTable)
      .set({
        endedAt,
        promptTokens: aiResult.promptTokens,
        completionTokens: aiResult.completionTokens,
        totalTokens: aiResult.totalTokens,
        estimatedCost: cost,
        status: "completed",
        output: aiResult.content,
      })
      .where(eq(executionsTable.id, execution.id));

    await db
      .update(tasksTable)
      .set({ status: "completed", result: aiResult.content, executionMs })
      .where(eq(tasksTable.id, taskId));

    await db.insert(memoriesTable).values([
      {
        agentId: agent.id,
        organizationId: task.organizationId,
        taskId: task.id,
        role: "user",
        content: task.input,
      },
      {
        agentId: agent.id,
        organizationId: task.organizationId,
        taskId: task.id,
        role: "assistant",
        content: aiResult.content,
      },
    ]);

    logger.info(
      { taskId, executionId: execution.id, executionMs, totalTokens: aiResult.totalTokens, cost },
      "Task completed",
    );

    return { taskId, executionId: execution.id, status: "completed" };
  } catch (err) {
    const endedAt = new Date();
    const errorMessage = err instanceof Error ? err.message : String(err);

    await db
      .update(executionsTable)
      .set({ endedAt, status: "failed", output: errorMessage })
      .where(eq(executionsTable.id, execution.id));

    await db
      .update(tasksTable)
      .set({
        status: "failed",
        errorMessage,
        executionMs: endedAt.getTime() - startedAt.getTime(),
      })
      .where(eq(tasksTable.id, taskId));

    logger.error({ taskId, executionId: execution.id, errorMessage }, "Task failed");

    return { taskId, executionId: execution.id, status: "failed", errorMessage };
  }
}
