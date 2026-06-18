import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, toolsTable } from "@workspace/db";
import { listTools, executeTool } from "../lib/tool-registry";
import { z } from "zod/v4";

const router: IRouter = Router();

router.get("/tools", async (_req, res): Promise<void> => {
  const [dbTools, builtinTools] = await Promise.all([
    db.select().from(toolsTable).orderBy(toolsTable.createdAt),
    Promise.resolve(listTools()),
  ]);

  res.json({
    builtin: builtinTools,
    registered: dbTools,
  });
});

router.post("/tools", async (req, res): Promise<void> => {
  const body = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    type: z.string().min(1),
    config: z.string().optional(),
  }).safeParse(req.body);

  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [tool] = await db.insert(toolsTable).values(body.data).returning();
  res.status(201).json(tool);
});

router.post("/tools/execute", async (req, res): Promise<void> => {
  const body = z.object({
    name: z.string().min(1),
    args: z.record(z.string(), z.unknown()).optional().default({}),
  }).safeParse(req.body);

  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const result = await executeTool({ name: body.data.name, args: body.data.args });
  res.json(result);
});

export default router;
