import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, agentsTable } from "@workspace/db";
import { CreateAgentBody } from "@workspace/api-zod";

const router: IRouter = Router();

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

router.post("/agents", async (req, res): Promise<void> => {
  const parsed = CreateAgentBody.safeParse(req.body);
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
    })
    .returning();

  req.log.info({ agentId: agent.id }, "Agent created");
  res.status(201).json(agent);
});

export default router;
