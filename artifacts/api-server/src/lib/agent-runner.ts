import { eq } from "drizzle-orm";
import { db, agentsTable, tasksTable, memoriesTable } from "@workspace/db";
import { runCompletion, type ChatMessage } from "./ai-service";
import { logger } from "./logger";

export type RunTaskResult = {
  taskId: number;
  result: string;
  executionMs: number;
  status: "completed" | "failed";
  errorMessage?: string;
};

export async function runAgentTask(taskId: number): Promise<RunTaskResult> {
  const start = Date.now();

  const [task] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, taskId));

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  const [agent] = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.id, task.agentId));

  if (!agent) {
    throw new Error(`Agent ${task.agentId} not found`);
  }

  await db
    .update(tasksTable)
    .set({ status: "running" })
    .where(eq(tasksTable.id, taskId));

  logger.info(
    { taskId, agentId: agent.id, agentName: agent.name },
    "Running agent task",
  );

  const recentMemories = await db
    .select()
    .from(memoriesTable)
    .where(eq(memoriesTable.agentId, agent.id))
    .orderBy(memoriesTable.createdAt)
    .limit(20);

  const messages: ChatMessage[] = [
    { role: "system", content: agent.systemPrompt },
    ...recentMemories.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: task.input },
  ];

  try {
    const aiResult = await runCompletion(messages, agent.model);
    const executionMs = Date.now() - start;

    await db
      .update(tasksTable)
      .set({
        status: "completed",
        result: aiResult.content,
        executionMs,
      })
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
      { taskId, executionMs, tokens: aiResult.promptTokens + aiResult.completionTokens },
      "Task completed",
    );

    return { taskId, result: aiResult.content, executionMs, status: "completed" };
  } catch (err) {
    const executionMs = Date.now() - start;
    const errorMessage = err instanceof Error ? err.message : String(err);

    await db
      .update(tasksTable)
      .set({ status: "failed", errorMessage, executionMs })
      .where(eq(tasksTable.id, taskId));

    logger.error({ taskId, errorMessage }, "Task failed");

    return { taskId, result: "", executionMs, status: "failed", errorMessage };
  }
}
