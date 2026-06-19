import { eq, and } from "drizzle-orm";
import { db, tasksTable, workflowRunsTable } from "@workspace/db";
import { runAgentTask } from "./agent-runner";
import { runWorkflow } from "./workflow-runner";
import { logger } from "./logger";
import { boss, QUEUES, startQueue, stopQueue } from "./queue";

// ─── pg-boss Workers ───────────────────────────────────────────────────────

async function startTaskWorker() {
  await boss.work<{ taskId: number }>(
    QUEUES.TASK_EXECUTION,
    { teamSize: 5, teamConcurrency: 5 },
    async (job) => {
      const { taskId } = job.data;
      logger.info({ taskId, jobId: job.id }, "[Worker] Processing task-execution job");
      await runAgentTask(taskId);
    },
  );

  logger.info("[Worker] task-execution worker registered (concurrency: 5)");
}

async function startWorkflowWorker() {
  await boss.work<{ workflowRunId: number }>(
    QUEUES.WORKFLOW_EXECUTION,
    { teamSize: 3, teamConcurrency: 3 },
    async (job) => {
      const { workflowRunId } = job.data;
      logger.info({ workflowRunId, jobId: job.id }, "[Worker] Processing workflow-execution job");
      // Claim run
      const [run] = await db
        .update(workflowRunsTable)
        .set({ status: "running" })
        .where(and(
          eq(workflowRunsTable.id, workflowRunId),
          eq(workflowRunsTable.status, "pending"),
        ))
        .returning();
      if (!run) return; // already claimed
      await runWorkflow(workflowRunId);
    },
  );

  logger.info("[Worker] workflow-execution worker registered (concurrency: 3)");
}

async function startEmailWorker() {
  await boss.work(
    QUEUES.EMAIL_GENERATION,
    { teamSize: 2, teamConcurrency: 2 },
    async (job) => {
      logger.info({ jobId: job.id, data: job.data }, "[Worker] email-generation job");
      // Pluggable: email generation tasks routed here
    },
  );
  logger.info("[Worker] email-generation worker registered");
}

async function startLeadWorker() {
  await boss.work(
    QUEUES.LEAD_GENERATION,
    { teamSize: 2, teamConcurrency: 2 },
    async (job) => {
      logger.info({ jobId: job.id, data: job.data }, "[Worker] lead-generation job");
      // Pluggable: lead generation tasks routed here
    },
  );
  logger.info("[Worker] lead-generation worker registered");
}

// ─── Fallback polling (drains tasks not submitted via queue) ───────────────

const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 5;
let pollerTimer: ReturnType<typeof setTimeout> | null = null;

async function pollPendingTasks(): Promise<void> {
  try {
    const pendingTasks = await db
      .select({ id: tasksTable.id })
      .from(tasksTable)
      .where(eq(tasksTable.status, "pending"))
      .limit(BATCH_SIZE);

    for (const { id } of pendingTasks) {
      const [claimed] = await db
        .update(tasksTable)
        .set({ status: "running" })
        .where(and(eq(tasksTable.id, id), eq(tasksTable.status, "pending")))
        .returning({ id: tasksTable.id });

      if (!claimed) continue;

      runAgentTask(id).catch((err: unknown) => {
        logger.error({ taskId: id, err: err instanceof Error ? err.message : String(err) }, "[Poller] unhandled error");
      });
    }
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "[Poller] poll error");
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function startWorker(): Promise<void> {
  await startQueue();
  await Promise.all([
    startTaskWorker(),
    startWorkflowWorker(),
    startEmailWorker(),
    startLeadWorker(),
  ]);

  // Fallback poller for tasks created directly in the DB (legacy path)
  const poll = () => {
    pollPendingTasks().finally(() => {
      pollerTimer = setTimeout(poll, POLL_INTERVAL_MS);
    });
  };
  poll();

  logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, "Background worker started (pg-boss + fallback poller)");
}

export async function stopWorker(): Promise<void> {
  if (pollerTimer) {
    clearTimeout(pollerTimer);
    pollerTimer = null;
  }
  await stopQueue();
  logger.info("Background worker stopped");
}
