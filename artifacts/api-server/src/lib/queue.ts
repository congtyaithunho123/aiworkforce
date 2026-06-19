import { PgBoss } from "pg-boss";
import { logger } from "./logger";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required for job queue");

export const boss = new PgBoss({
  connectionString: DATABASE_URL,
  retryLimit: 3,
  retryDelay: 30,        // seconds between retries
  retryBackoff: true,    // exponential backoff
  expireInHours: 24,
  deleteAfterHours: 72,  // keep completed jobs 3 days for monitoring
  monitorStateIntervalSeconds: 30,
  archiveCompletedAfterSeconds: 3600,
});

// Queue names
export const QUEUES = {
  TASK_EXECUTION: "task-execution",
  WORKFLOW_EXECUTION: "workflow-execution",
  EMAIL_GENERATION: "email-generation",
  LEAD_GENERATION: "lead-generation",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

boss.on("error", (err) => {
  logger.error({ err: err.message }, "[Queue] pg-boss error");
});

boss.on("monitor-states", (states) => {
  const active = Object.values(states).reduce((s: number, v) => {
    if (typeof v === "number") return s + v;
    return s;
  }, 0);
  if (active > 0) {
    logger.info({ states }, "[Queue] monitor-states");
  }
});

export async function startQueue(): Promise<void> {
  await boss.start();
  // pg-boss v10+ requires queues to be explicitly created before use
  await Promise.all(Object.values(QUEUES).map((q) => boss.createQueue(q)));
  logger.info("[Queue] pg-boss started — queues: task-execution, workflow-execution, email-generation, lead-generation");
}

export async function stopQueue(): Promise<void> {
  await boss.stop();
  logger.info("[Queue] pg-boss stopped");
}

// Enqueue a task for execution
export async function enqueueTask(taskId: number, priority: number = 0): Promise<string | null> {
  return boss.send(QUEUES.TASK_EXECUTION, { taskId }, { priority, retryLimit: 3, retryBackoff: true });
}

// Enqueue a workflow run
export async function enqueueWorkflow(workflowRunId: number): Promise<string | null> {
  return boss.send(QUEUES.WORKFLOW_EXECUTION, { workflowRunId }, { retryLimit: 2, retryBackoff: true });
}

// Enqueue email generation (lower priority)
export async function enqueueEmailGeneration(data: Record<string, unknown>): Promise<string | null> {
  return boss.send(QUEUES.EMAIL_GENERATION, data, { priority: -1, retryLimit: 3 });
}

// Enqueue lead generation (lower priority)
export async function enqueueLeadGeneration(data: Record<string, unknown>): Promise<string | null> {
  return boss.send(QUEUES.LEAD_GENERATION, data, { priority: -1, retryLimit: 3 });
}

// Get queue stats for monitoring endpoint
export async function getQueueStats() {
  const [taskStats, workflowStats, emailStats, leadStats] = await Promise.all([
    boss.getQueueSize(QUEUES.TASK_EXECUTION),
    boss.getQueueSize(QUEUES.WORKFLOW_EXECUTION),
    boss.getQueueSize(QUEUES.EMAIL_GENERATION),
    boss.getQueueSize(QUEUES.LEAD_GENERATION),
  ]);

  return {
    queues: {
      [QUEUES.TASK_EXECUTION]: taskStats,
      [QUEUES.WORKFLOW_EXECUTION]: workflowStats,
      [QUEUES.EMAIL_GENERATION]: emailStats,
      [QUEUES.LEAD_GENERATION]: leadStats,
    },
  };
}
