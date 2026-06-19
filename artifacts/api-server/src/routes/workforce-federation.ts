import { Router } from "express";
import { eq, and, or, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { db, federationAgreementsTable, organizationsTable, agentsTable, workflowsTable } from "@workspace/db";
import { emitEvent } from "./workforce-cloud";
import crypto from "node:crypto";

const router = Router();

// POST /api/workforce/federation/link — Request cross-org link
router.post("/api/workforce/federation/link", async (req, res) => {
  const schema = z.object({
    providerOrganizationId: z.number(),
    sharedCapabilities: z.array(z.string()).default([]),
    sharedAgentIds: z.array(z.number()).default([]),
    sharedWorkflowIds: z.array(z.number()).default([]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const orgId = req.user!.organizationId;
  if (parsed.data.providerOrganizationId === orgId) {
    return res.status(400).json({ error: "Cannot federate with yourself" });
  }

  const provider = await db.select().from(organizationsTable)
    .where(eq(organizationsTable.id, parsed.data.providerOrganizationId)).limit(1);
  if (!provider[0]) return res.status(404).json({ error: "Provider organization not found" });

  const apiKey = `wf_fed_${crypto.randomBytes(24).toString("hex")}`;

  const [agreement] = await db.insert(federationAgreementsTable).values({
    requesterOrganizationId: orgId,
    providerOrganizationId: parsed.data.providerOrganizationId,
    sharedCapabilities: parsed.data.sharedCapabilities,
    sharedAgentIds: parsed.data.sharedAgentIds,
    sharedWorkflowIds: parsed.data.sharedWorkflowIds,
    apiKey,
    status: "pending",
    isActive: false,
  }).returning();

  await emitEvent(orgId, "FEDERATION_REQUEST", {
    agreementId: agreement.id,
    providerOrganizationId: parsed.data.providerOrganizationId,
    providerName: provider[0].name,
  }, { sourceType: "federation", message: `Federation request sent to ${provider[0].name}` });

  res.status(201).json({ agreement: { ...agreement, apiKey } });
});

// GET /api/workforce/federation
router.get("/api/workforce/federation", async (req, res) => {
  const orgId = req.user!.organizationId;

  const agreements = await db.select().from(federationAgreementsTable)
    .where(or(
      eq(federationAgreementsTable.requesterOrganizationId, orgId),
      eq(federationAgreementsTable.providerOrganizationId, orgId),
    ))
    .orderBy(desc(federationAgreementsTable.createdAt));

  res.json({ agreements });
});

// PATCH /api/workforce/federation/:id/approve
router.patch("/api/workforce/federation/:id/approve", async (req, res) => {
  const id = Number(req.params.id);
  const orgId = req.user!.organizationId;

  const [agreement] = await db.select().from(federationAgreementsTable)
    .where(and(eq(federationAgreementsTable.id, id), eq(federationAgreementsTable.providerOrganizationId, orgId)));
  if (!agreement) return res.status(404).json({ error: "Agreement not found or not authorized" });

  const [updated] = await db.update(federationAgreementsTable)
    .set({ status: "approved", isActive: true })
    .where(eq(federationAgreementsTable.id, id))
    .returning();

  await emitEvent(orgId, "FEDERATION_LINKED", {
    agreementId: id,
    partnerOrganizationId: agreement.requesterOrganizationId,
  }, { severity: "info", sourceType: "federation", message: "Federation approved and active" });

  res.json({ agreement: updated });
});

// PATCH /api/workforce/federation/:id/revoke
router.patch("/api/workforce/federation/:id/revoke", async (req, res) => {
  const id = Number(req.params.id);
  const orgId = req.user!.organizationId;

  const [updated] = await db.update(federationAgreementsTable)
    .set({ status: "revoked", isActive: false })
    .where(and(
      eq(federationAgreementsTable.id, id),
      or(
        eq(federationAgreementsTable.requesterOrganizationId, orgId),
        eq(federationAgreementsTable.providerOrganizationId, orgId),
      ),
    ))
    .returning();

  if (!updated) return res.status(404).json({ error: "Agreement not found" });
  res.json({ agreement: updated });
});

// GET /api/workforce/federation/:id/shared — view shared agents & workflows
router.get("/api/workforce/federation/:id/shared", async (req, res) => {
  const id = Number(req.params.id);
  const orgId = req.user!.organizationId;

  const [agreement] = await db.select().from(federationAgreementsTable)
    .where(and(
      eq(federationAgreementsTable.id, id),
      or(
        eq(federationAgreementsTable.requesterOrganizationId, orgId),
        eq(federationAgreementsTable.providerOrganizationId, orgId),
      ),
    ));
  if (!agreement) return res.status(404).json({ error: "Agreement not found" });

  const agentIds = (agreement.sharedAgentIds as number[]) ?? [];
  const workflowIds = (agreement.sharedWorkflowIds as number[]) ?? [];

  const sharedAgents = agentIds.length > 0
    ? await db.select().from(agentsTable).where(eq(agentsTable.organizationId, agreement.providerOrganizationId))
    : [];
  const sharedWorkflows = workflowIds.length > 0
    ? await db.select().from(workflowsTable).where(eq(workflowsTable.organizationId, agreement.providerOrganizationId))
    : [];

  res.json({
    agreement,
    sharedAgents: sharedAgents.filter((a) => agentIds.includes(a.id)),
    sharedWorkflows: sharedWorkflows.filter((w) => workflowIds.includes(w.id)),
  });
});

export default router;
