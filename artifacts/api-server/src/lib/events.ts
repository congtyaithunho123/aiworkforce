import { EventEmitter } from "events";

export type TaskEvent =
  | { type: "task_started"; taskId: number; agentId: number; agentName: string; input: string; organizationId: number }
  | { type: "task_progress"; taskId: number; executionId: number; message: string; percent: number; organizationId: number }
  | { type: "task_completed"; taskId: number; executionId: number; durationMs: number; tokens: number; cost: number; organizationId: number }
  | { type: "task_failed"; taskId: number; executionId: number; error: string; organizationId: number }
  | { type: "workflow_started"; workflowId: number; runId: number; name: string; stepCount: number; organizationId: number }
  | { type: "workflow_step"; workflowId: number; runId: number; step: number; stepName: string; percent: number; organizationId: number }
  | { type: "workflow_completed"; workflowId: number; runId: number; durationMs: number; organizationId: number }
  | { type: "workflow_failed"; workflowId: number; runId: number; error: string; organizationId: number }
  | { type: "budget_warning"; organizationId: number; percentUsed: number; spent: number; budget: number }
  | { type: "budget_exceeded"; organizationId: number; spent: number; budget: number };

class TaskEventBus extends EventEmitter {
  emit(event: "task_event", data: TaskEvent): boolean {
    return super.emit("task_event", data);
  }

  on(event: "task_event", listener: (data: TaskEvent) => void): this {
    return super.on("task_event", listener);
  }

  publish(data: TaskEvent): void {
    this.emit("task_event", data);
  }
}

export const eventBus = new TaskEventBus();
eventBus.setMaxListeners(200);
