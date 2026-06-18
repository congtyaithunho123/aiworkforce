import { eq, and } from "drizzle-orm";
import { db, tasksTable } from "@workspace/db";
import { runAgentTask } from "./agent-runner";
import { logger } from "./logger";

const POLL_INTERVAL_MS = 3000;
const BATCH_SIZE = 5;

let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;

async function processPendingTasks(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const pendingTasks = await db
      .select({ id: tasksTable.id })
      .from(tasksTable)
      .where(eq(tasksTable.status, "pending"))
      .limit(BATCH_SIZE);

    if (pendingTasks.length === 0) {
      return;
    }

    logger.info({ count: pendingTasks.length }, "Worker picked up pending tasks");

    for (const { id } of pendingTasks) {
      const [claimed] = await db
        .update(tasksTable)
        .set({ status: "running" })
        .where(and(eq(tasksTable.id, id), eq(tasksTable.status, "pending")))
        .returning({ id: tasksTable.id });

      if (!claimed) {
        continue;
      }

      runAgentTask(id).catch((err: unknown) => {
        logger.error(
          { taskId: id, err: err instanceof Error ? err.message : String(err) },
          "Worker: unhandled error in runAgentTask",
        );
      });
    }
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "Worker poll error",
    );
  } finally {
    running = false;
  }
}

export function startWorker(): void {
  logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, "Background worker started");

  const poll = (): void => {
    processPendingTasks().finally(() => {
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    });
  };

  poll();
}

export function stopWorker(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  logger.info("Background worker stopped");
}
