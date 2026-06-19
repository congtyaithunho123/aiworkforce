import { Router, Request, Response } from "express";
import { eventBus, type TaskEvent } from "../lib/events";

const router = Router();

/**
 * GET /stream — Server-Sent Events
 * Client connects once; receives real-time task/workflow events for their organization.
 *
 * Event format:  data: {"type":"task_started","taskId":1,...}\n\n
 */
router.get("/stream", (req: Request, res: Response): void => {
  const orgId = req.user!.organizationId;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Send initial heartbeat so client knows connection is live
  res.write(`data: ${JSON.stringify({ type: "connected", organizationId: orgId })}\n\n`);

  const handler = (event: TaskEvent) => {
    if (event.organizationId !== orgId) return;
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      // client disconnected mid-write
    }
  };

  eventBus.on("task_event", handler);

  // Heartbeat every 15s to prevent proxy timeouts
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    eventBus.removeListener("task_event", handler);
  });
});

export default router;
