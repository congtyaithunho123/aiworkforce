import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import {
  db,
  departmentsTable,
  departmentAgentsTable,
  agentsTable,
} from "@workspace/db";
import { runDepartment } from "../lib/department-manager";
import { z } from "zod/v4";

const router: IRouter = Router();

const CreateDeptBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  managerAgentId: z.number().int().positive().optional(),
});

router.get("/departments", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const depts = await db
    .select()
    .from(departmentsTable)
    .where(eq(departmentsTable.organizationId, orgId));

  const deptsWithAgents = await Promise.all(
    depts.map(async (dept: typeof departmentsTable.$inferSelect) => {
      const links = await db
        .select({ agentId: departmentAgentsTable.agentId })
        .from(departmentAgentsTable)
        .where(eq(departmentAgentsTable.departmentId, dept.id));

      const agentIds = links.map((l: { agentId: number }) => l.agentId);
      const agents =
        agentIds.length > 0
          ? await db.select().from(agentsTable).where(inArray(agentsTable.id, agentIds))
          : [];

      const managerAgent = dept.managerAgentId
        ? agents.find((a: typeof agentsTable.$inferSelect) => a.id === dept.managerAgentId) ?? null
        : null;

      return { ...dept, agents, managerAgent };
    }),
  );

  res.json(deptsWithAgents);
});

router.post("/departments", async (req, res): Promise<void> => {
  const parsed = CreateDeptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const orgId = req.user!.organizationId;

  const [dept] = await db
    .insert(departmentsTable)
    .values({
      organizationId: orgId,
      name: parsed.data.name,
      description: parsed.data.description,
      managerAgentId: parsed.data.managerAgentId,
    })
    .returning();

  res.status(201).json(dept);
});

router.post("/departments/:id/agents", async (req, res): Promise<void> => {
  const deptId = parseInt(req.params.id, 10);
  const orgId = req.user!.organizationId;
  const { agentId } = req.body as { agentId?: number };
  if (isNaN(deptId) || !agentId) {
    res.status(400).json({ error: "Invalid departmentId or agentId" });
    return;
  }

  const [dept] = await db
    .select()
    .from(departmentsTable)
    .where(and(eq(departmentsTable.id, deptId), eq(departmentsTable.organizationId, orgId)));
  if (!dept) { res.status(404).json({ error: "Department not found" }); return; }

  const [agent] = await db
    .select()
    .from(agentsTable)
    .where(and(eq(agentsTable.id, agentId), eq(agentsTable.organizationId, orgId)));
  if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }

  await db
    .insert(departmentAgentsTable)
    .values({ departmentId: deptId, agentId })
    .onConflictDoNothing();

  res.status(201).json({ departmentId: deptId, agentId });
});

router.delete("/departments/:id/agents/:agentId", async (req, res): Promise<void> => {
  const deptId = parseInt(req.params.id, 10);
  const agentId = parseInt(req.params.agentId, 10);
  const orgId = req.user!.organizationId;
  if (isNaN(deptId) || isNaN(agentId)) {
    res.status(400).json({ error: "Invalid ids" });
    return;
  }

  const [dept] = await db
    .select()
    .from(departmentsTable)
    .where(and(eq(departmentsTable.id, deptId), eq(departmentsTable.organizationId, orgId)));
  if (!dept) { res.status(404).json({ error: "Department not found" }); return; }

  await db
    .delete(departmentAgentsTable)
    .where(eq(departmentAgentsTable.departmentId, deptId));
  res.json({ success: true });
});

router.post("/departments/:id/run", async (req, res): Promise<void> => {
  const deptId = parseInt(req.params.id, 10);
  const orgId = req.user!.organizationId;
  const { input } = req.body as { input?: string };
  if (isNaN(deptId) || !input) {
    res.status(400).json({ error: "departmentId and input are required" });
    return;
  }

  const [dept] = await db
    .select()
    .from(departmentsTable)
    .where(and(eq(departmentsTable.id, deptId), eq(departmentsTable.organizationId, orgId)));
  if (!dept) { res.status(404).json({ error: "Department not found" }); return; }

  try {
    const result = await runDepartment(deptId, input);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
