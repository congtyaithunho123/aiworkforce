import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { db, promptVersionsTable, agentsTable } from "@workspace/db";

const router = Router();

// GET /agents/:agentId/prompt-versions
router.get("/agents/:agentId/prompt-versions", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const agentId = parseInt(req.params.agentId);

  const versions = await db.select().from(promptVersionsTable)
    .where(and(
      eq(promptVersionsTable.agentId, agentId),
      eq(promptVersionsTable.organizationId, orgId),
    ))
    .orderBy(desc(promptVersionsTable.version));

  res.json(versions);
});

// POST /agents/:agentId/prompt-versions — save new version
const SaveVersionBody = z.object({
  systemPrompt: z.string().min(1),
  changeNote: z.string().optional(),
});

router.post("/agents/:agentId/prompt-versions", async (req, res): Promise<void> => {
  const parsed = SaveVersionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const orgId = req.user!.organizationId;
  const agentId = parseInt(req.params.agentId);
  const userId = req.user!.userId;

  // Verify agent belongs to org
  const [agent] = await db.select().from(agentsTable)
    .where(and(eq(agentsTable.id, agentId), eq(agentsTable.organizationId, orgId)));
  if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }

  // Get max version for this agent
  const existing = await db.select({ version: promptVersionsTable.version })
    .from(promptVersionsTable)
    .where(and(eq(promptVersionsTable.agentId, agentId), eq(promptVersionsTable.organizationId, orgId)))
    .orderBy(desc(promptVersionsTable.version))
    .limit(1);

  const nextVersion = (existing[0]?.version ?? 0) + 1;

  // Deactivate all existing versions
  await db.update(promptVersionsTable)
    .set({ isActive: false })
    .where(and(eq(promptVersionsTable.agentId, agentId), eq(promptVersionsTable.organizationId, orgId)));

  const [version] = await db.insert(promptVersionsTable).values({
    organizationId: orgId,
    agentId,
    version: nextVersion,
    systemPrompt: parsed.data.systemPrompt,
    changeNote: parsed.data.changeNote,
    isActive: true,
    createdBy: userId,
  }).returning();

  // Update the agent's system prompt
  await db.update(agentsTable).set({ systemPrompt: parsed.data.systemPrompt })
    .where(eq(agentsTable.id, agentId));

  res.status(201).json(version);
});

// POST /agents/:agentId/prompt-versions/:versionId/rollback
router.post("/agents/:agentId/prompt-versions/:versionId/rollback", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const agentId = parseInt(req.params.agentId);
  const versionId = parseInt(req.params.versionId);

  const [version] = await db.select().from(promptVersionsTable)
    .where(and(
      eq(promptVersionsTable.id, versionId),
      eq(promptVersionsTable.agentId, agentId),
      eq(promptVersionsTable.organizationId, orgId),
    ));
  if (!version) { res.status(404).json({ error: "Version not found" }); return; }

  // Deactivate all, activate this one
  await db.update(promptVersionsTable)
    .set({ isActive: false })
    .where(and(eq(promptVersionsTable.agentId, agentId), eq(promptVersionsTable.organizationId, orgId)));

  await db.update(promptVersionsTable).set({ isActive: true }).where(eq(promptVersionsTable.id, versionId));

  // Update agent
  await db.update(agentsTable).set({ systemPrompt: version.systemPrompt })
    .where(eq(agentsTable.id, agentId));

  res.json({ success: true, rolledBackTo: version.version });
});

export default router;
