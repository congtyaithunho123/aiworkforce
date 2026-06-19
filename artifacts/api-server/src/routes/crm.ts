import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { db, customersTable, dealsTable, activitiesTable } from "@workspace/db";

const router = Router();

// ─── CUSTOMERS ──────────────────────────────────────────────────────────────

const CustomerBody = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  status: z.enum(["lead", "demo", "trial", "paid", "churned"]).optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

// GET /crm/customers
router.get("/crm/customers", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const customers = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.organizationId, orgId))
    .orderBy(desc(customersTable.createdAt));
  res.json(customers);
});

// POST /crm/customers
router.post("/crm/customers", async (req, res): Promise<void> => {
  const parsed = CustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const orgId = req.user!.organizationId;
  const [customer] = await db
    .insert(customersTable)
    .values({ ...parsed.data, organizationId: orgId })
    .returning();

  res.status(201).json(customer);
});

// GET /crm/customers/:id
router.get("/crm/customers/:id", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.id, Number(req.params.id)), eq(customersTable.organizationId, orgId)));

  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json(customer);
});

// PATCH /crm/customers/:id
router.patch("/crm/customers/:id", async (req, res): Promise<void> => {
  const parsed = CustomerBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const orgId = req.user!.organizationId;
  const [customer] = await db
    .update(customersTable)
    .set(parsed.data)
    .where(and(eq(customersTable.id, Number(req.params.id)), eq(customersTable.organizationId, orgId)))
    .returning();

  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json(customer);
});

// DELETE /crm/customers/:id
router.delete("/crm/customers/:id", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  await db
    .delete(customersTable)
    .where(and(eq(customersTable.id, Number(req.params.id)), eq(customersTable.organizationId, orgId)));
  res.json({ success: true });
});

// ─── DEALS ──────────────────────────────────────────────────────────────────

const DealBody = z.object({
  customerId: z.number().int(),
  title: z.string().min(1),
  stage: z.enum(["lead", "demo", "trial", "paid"]).optional(),
  value: z.number().min(0).optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  closedAt: z.string().datetime().optional(),
});

// GET /crm/deals
router.get("/crm/deals", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const deals = await db
    .select()
    .from(dealsTable)
    .where(eq(dealsTable.organizationId, orgId))
    .orderBy(desc(dealsTable.createdAt));
  res.json(deals);
});

// GET /crm/pipeline — grouped by stage for Kanban
router.get("/crm/pipeline", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const [deals, customers] = await Promise.all([
    db.select().from(dealsTable).where(eq(dealsTable.organizationId, orgId)).orderBy(desc(dealsTable.createdAt)),
    db.select().from(customersTable).where(eq(customersTable.organizationId, orgId)),
  ]);

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));

  const pipeline: Record<string, typeof deals> = {
    lead: [],
    demo: [],
    trial: [],
    paid: [],
  };

  for (const deal of deals) {
    const stage = deal.stage as keyof typeof pipeline;
    if (pipeline[stage]) {
      pipeline[stage].push({ ...deal, customer: customerMap[deal.customerId] } as typeof deal & { customer: typeof customers[0] });
    }
  }

  res.json({ pipeline, customers });
});

// POST /crm/deals
router.post("/crm/deals", async (req, res): Promise<void> => {
  const parsed = DealBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const orgId = req.user!.organizationId;

  // Verify customer belongs to org
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.id, parsed.data.customerId), eq(customersTable.organizationId, orgId)));

  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }

  const [deal] = await db
    .insert(dealsTable)
    .values({
      ...parsed.data,
      organizationId: orgId,
      closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : undefined,
    })
    .returning();

  res.status(201).json(deal);
});

// PATCH /crm/deals/:id/stage — move stage (Kanban drag)
const StageBody = z.object({ stage: z.enum(["lead", "demo", "trial", "paid"]) });

router.patch("/crm/deals/:id/stage", async (req, res): Promise<void> => {
  const parsed = StageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const orgId = req.user!.organizationId;
  const closedAt = parsed.data.stage === "paid" ? new Date() : null;

  const [deal] = await db
    .update(dealsTable)
    .set({ stage: parsed.data.stage, closedAt: closedAt ?? undefined })
    .where(and(eq(dealsTable.id, Number(req.params.id)), eq(dealsTable.organizationId, orgId)))
    .returning();

  if (!deal) { res.status(404).json({ error: "Deal not found" }); return; }

  // Log activity for stage change
  await db.insert(activitiesTable).values({
    organizationId: orgId,
    dealId: deal.id,
    type: "stage_change",
    description: `Deal moved to stage: ${parsed.data.stage}`,
  });

  res.json(deal);
});

// PATCH /crm/deals/:id
router.patch("/crm/deals/:id", async (req, res): Promise<void> => {
  const parsed = DealBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const orgId = req.user!.organizationId;
  const [deal] = await db
    .update(dealsTable)
    .set({
      ...parsed.data,
      closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : undefined,
    })
    .where(and(eq(dealsTable.id, Number(req.params.id)), eq(dealsTable.organizationId, orgId)))
    .returning();

  if (!deal) { res.status(404).json({ error: "Deal not found" }); return; }
  res.json(deal);
});

// DELETE /crm/deals/:id
router.delete("/crm/deals/:id", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  await db
    .delete(dealsTable)
    .where(and(eq(dealsTable.id, Number(req.params.id)), eq(dealsTable.organizationId, orgId)));
  res.json({ success: true });
});

// ─── ACTIVITIES ──────────────────────────────────────────────────────────────

const ActivityBody = z.object({
  dealId: z.number().int(),
  type: z.enum(["note", "call", "email", "meeting", "stage_change"]).optional(),
  description: z.string().min(1),
});

// GET /crm/activities?dealId=X
router.get("/crm/activities", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const dealId = req.query.dealId ? Number(req.query.dealId) : null;

  let query = db
    .select()
    .from(activitiesTable)
    .where(eq(activitiesTable.organizationId, orgId))
    .$dynamic();

  if (dealId) {
    query = query.where(and(eq(activitiesTable.organizationId, orgId), eq(activitiesTable.dealId, dealId)));
  }

  const activities = await query.orderBy(desc(activitiesTable.createdAt)).limit(100);
  res.json(activities);
});

// POST /crm/activities
router.post("/crm/activities", async (req, res): Promise<void> => {
  const parsed = ActivityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const orgId = req.user!.organizationId;
  const [activity] = await db
    .insert(activitiesTable)
    .values({ ...parsed.data, organizationId: orgId })
    .returning();

  res.status(201).json(activity);
});

export default router;
