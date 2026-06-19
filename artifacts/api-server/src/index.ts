import app from "./app";
import { logger } from "./lib/logger";
import { startWorker, stopWorker } from "./lib/worker";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Start job queue + workers (async — non-blocking)
  startWorker().catch((err) => {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "Worker startup error — server continues");
  });
});

// Graceful shutdown
const shutdown = async () => {
  logger.info("Shutting down gracefully...");
  server.close(() => logger.info("HTTP server closed"));
  await stopWorker();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
