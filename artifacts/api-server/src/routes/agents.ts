import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, agentsTable } from "@workspace/db";
import { requireRole } from "../middleware/require-role";

const router: IRouter = Router();

const CreateAgentInput = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  systemPrompt: z.string().min(1),
  model: z.string().optional(),
  outputFormat: z.enum(["text", "json"]).optional(),
  outputSchema: z.string().optional(),
  capabilities: z.string().optional(),
});

router.get("/agents", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  req.log.info("Listing agents");
  const agents = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.organizationId, orgId))
    .orderBy(agentsTable.createdAt);
  res.json(agents);
});

router.post("/agents", requireRole(["owner", "admin"]), async (req, res): Promise<void> => {
  const parsed = CreateAgentInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const orgId = req.user!.organizationId;

  const [agent] = await db
    .insert(agentsTable)
    .values({
      organizationId: orgId,
      name: parsed.data.name,
      role: parsed.data.role,
      systemPrompt: parsed.data.systemPrompt,
      ...(parsed.data.model ? { model: parsed.data.model } : {}),
      ...(parsed.data.outputFormat ? { outputFormat: parsed.data.outputFormat } : {}),
      ...(parsed.data.outputSchema ? { outputSchema: parsed.data.outputSchema } : {}),
      ...(parsed.data.capabilities ? { capabilities: parsed.data.capabilities } : {}),
    })
    .returning();

  req.log.info({ agentId: agent.id }, "Agent created");
  res.status(201).json(agent);
});

export default router;
