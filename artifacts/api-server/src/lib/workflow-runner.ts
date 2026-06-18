import { eq, asc } from "drizzle-orm";
import {
  db,
  workflowsTable,
  workflowStepsTable,
  workflowRunsTable,
  workflowStepLogsTable,
  agentsTable,
} from "@workspace/db";
import { runCompletion, estimateCost } from "./ai-service";
import { runReviewerAgent, type StepResult } from "./reviewer-agent";
import { logger } from "./logger";

export type WorkflowRunResult = {
  workflowRunId: number;
  status: "completed" | "failed";
  finalOutput?: string;
  errorMessage?: string;
  totalTokens: number;
  totalCost: number;
  durationMs: number;
  stepLogs: Array<{
    stepName: string;
    agentName: string;
    status: string;
    durationMs: number;
    tokens: number;
    cost: number;
  }>;
};

export async function runWorkflow(
  workflowId: number,
  userInput: string,
): Promise<WorkflowRunResult> {
  const startedAt = new Date();

  const [workflow] = await db
    .select()
    .from(workflowsTable)
    .where(eq(workflowsTable.id, workflowId));

  if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

  const steps = await db
    .select()
    .from(workflowStepsTable)
    .where(eq(workflowStepsTable.workflowId, workflowId))
    .orderBy(asc(workflowStepsTable.order));

  if (steps.length === 0) throw new Error(`Workflow ${workflowId} has no steps`);

  const [workflowRun] = await db
    .insert(workflowRunsTable)
    .values({
      workflowId,
      status: "running",
      input: userInput,
    })
    .returning();

  logger.info(
    { workflowId, workflowRunId: workflowRun.id, stepCount: steps.length },
    "Workflow run started",
  );

  let previousOutput = userInput;
  let totalTokens = 0;
  let totalCost = 0;
  const stepLogs: WorkflowRunResult["stepLogs"] = [];
  const stepResults: StepResult[] = [];

  try {
    for (const step of steps) {
      const [agent] = await db
        .select()
        .from(agentsTable)
        .where(eq(agentsTable.id, step.agentId));

      if (!agent) throw new Error(`Agent ${step.agentId} not found for step ${step.id}`);

      const stepInput = buildStepInput(step.instruction, previousOutput, userInput);
      const stepStartedAt = new Date();

      const [stepLog] = await db
        .insert(workflowStepLogsTable)
        .values({
          workflowRunId: workflowRun.id,
          workflowStepId: step.id,
          agentId: agent.id,
          stepOrder: step.order,
          stepName: step.name,
          status: "running",
          input: stepInput,
        })
        .returning();

      logger.info(
        { workflowRunId: workflowRun.id, stepId: step.id, stepName: step.name, agentId: agent.id },
        "Workflow step started",
      );

      try {
        const aiResult = await runCompletion(
          [
            { role: "system", content: agent.systemPrompt },
            { role: "user", content: stepInput },
          ],
          {
            model: agent.model,
            outputFormat: (agent.outputFormat as "text" | "json") ?? "text",
            outputSchema: agent.outputSchema,
          },
        );

        const stepEndedAt = new Date();
        const stepDurationMs = stepEndedAt.getTime() - stepStartedAt.getTime();
        const stepCost = estimateCost(aiResult.model, aiResult.promptTokens, aiResult.completionTokens);

        totalTokens += aiResult.totalTokens;
        totalCost += stepCost;

        await db
          .update(workflowStepLogsTable)
          .set({
            status: "completed",
            output: aiResult.content,
            promptTokens: aiResult.promptTokens,
            completionTokens: aiResult.completionTokens,
            totalTokens: aiResult.totalTokens,
            estimatedCost: stepCost,
            durationMs: stepDurationMs,
            completedAt: stepEndedAt,
          })
          .where(eq(workflowStepLogsTable.id, stepLog.id));

        stepResults.push({
          stepName: step.name,
          agentName: agent.name,
          input: stepInput,
          output: aiResult.content,
        });

        stepLogs.push({
          stepName: step.name,
          agentName: agent.name,
          status: "completed",
          durationMs: stepDurationMs,
          tokens: aiResult.totalTokens,
          cost: stepCost,
        });

        previousOutput = aiResult.content;

        logger.info(
          {
            workflowRunId: workflowRun.id,
            stepName: step.name,
            stepDurationMs,
            tokens: aiResult.totalTokens,
            cost: stepCost,
          },
          "Workflow step completed",
        );
      } catch (stepErr) {
        const stepEndedAt = new Date();
        const stepDurationMs = stepEndedAt.getTime() - stepStartedAt.getTime();
        const errorMessage = stepErr instanceof Error ? stepErr.message : String(stepErr);

        await db
          .update(workflowStepLogsTable)
          .set({
            status: "failed",
            errorMessage,
            durationMs: stepDurationMs,
            completedAt: stepEndedAt,
          })
          .where(eq(workflowStepLogsTable.id, stepLog.id));

        stepLogs.push({
          stepName: step.name,
          agentName: agent.name,
          status: "failed",
          durationMs: stepDurationMs,
          tokens: 0,
          cost: 0,
        });

        throw new Error(`Step "${step.name}" failed: ${errorMessage}`);
      }
    }

    const reviewerResult = await runReviewerAgent(userInput, stepResults);
    totalTokens += reviewerResult.aiResult.totalTokens;
    const reviewerCost = estimateCost(
      reviewerResult.aiResult.model,
      reviewerResult.aiResult.promptTokens,
      reviewerResult.aiResult.completionTokens,
    );
    totalCost += reviewerCost;

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    await db
      .update(workflowRunsTable)
      .set({
        status: "completed",
        finalOutput: reviewerResult.content,
        totalTokens,
        totalCost,
        durationMs,
        completedAt,
      })
      .where(eq(workflowRunsTable.id, workflowRun.id));

    logger.info(
      { workflowRunId: workflowRun.id, durationMs, totalTokens, totalCost },
      "Workflow run completed",
    );

    return {
      workflowRunId: workflowRun.id,
      status: "completed",
      finalOutput: reviewerResult.content,
      totalTokens,
      totalCost,
      durationMs,
      stepLogs,
    };
  } catch (err) {
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    const errorMessage = err instanceof Error ? err.message : String(err);

    await db
      .update(workflowRunsTable)
      .set({
        status: "failed",
        errorMessage,
        totalTokens,
        totalCost,
        durationMs,
        completedAt,
      })
      .where(eq(workflowRunsTable.id, workflowRun.id));

    logger.error({ workflowRunId: workflowRun.id, errorMessage }, "Workflow run failed");

    return {
      workflowRunId: workflowRun.id,
      status: "failed",
      errorMessage,
      totalTokens,
      totalCost,
      durationMs,
      stepLogs,
    };
  }
}

function buildStepInput(
  stepInstruction: string,
  previousOutput: string,
  originalInput: string,
): string {
  return `Yêu cầu gốc của người dùng:
${originalInput}

Nhiệm vụ của bạn trong bước này:
${stepInstruction}

Kết quả từ bước trước (context):
${previousOutput}

Hãy thực hiện nhiệm vụ của bạn dựa trên context trên.`;
}
