import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  teamsTable,
  teamAgentsTable,
  departmentsTable,
  departmentAgentsTable,
  agentsTable,
  organizationsTable,
} from "@workspace/db";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// TEAMS CRUD
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/workforce/teams
router.post("/api/workforce/teams", async (req, res) => {
  const schema = z.object({
    departmentId: z.number(),
    name: z.string().min(1),
    description: z.string().optional(),
    leadAgentId: z.number().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const orgId = req.user!.organizationId;

  const dept = await db.select().from(departmentsTable)
    .where(and(eq(departmentsTable.id, parsed.data.departmentId), eq(departmentsTable.organizationId, orgId)))
    .limit(1);
  if (!dept[0]) return res.status(404).json({ error: "Department not found" });

  const [team] = await db.insert(teamsTable).values({
    ...parsed.data,
    organizationId: orgId,
    leadAgentId: parsed.data.leadAgentId ?? null,
  }).returning();

  res.status(201).json({ team });
});

// GET /api/workforce/teams
router.get("/api/workforce/teams", async (req, res) => {
  const orgId = req.user!.organizationId;
  const deptId = req.query.departmentId ? Number(req.query.departmentId) : undefined;

  const conditions: ReturnType<typeof eq>[] = [eq(teamsTable.organizationId, orgId)];
  if (deptId) conditions.push(eq(teamsTable.departmentId, deptId));

  const teams = await db.select().from(teamsTable).where(and(...conditions)).orderBy(teamsTable.name);
  res.json({ teams });
});

// POST /api/workforce/teams/:id/agents
router.post("/api/workforce/teams/:id/agents", async (req, res) => {
  const teamId = Number(req.params.id);
  const orgId = req.user!.organizationId;
  const { agentId, role } = z.object({ agentId: z.number(), role: z.string().default("member") }).parse(req.body);

  const team = await db.select().from(teamsTable).where(and(eq(teamsTable.id, teamId), eq(teamsTable.organizationId, orgId))).limit(1);
  if (!team[0]) return res.status(404).json({ error: "Team not found" });

  const [ta] = await db.insert(teamAgentsTable).values({ teamId, agentId, role }).returning();
  res.status(201).json({ teamAgent: ta });
});

// DELETE /api/workforce/teams/:id/agents/:agentId
router.delete("/api/workforce/teams/:id/agents/:agentId", async (req, res) => {
  const teamId = Number(req.params.id);
  const agentId = Number(req.params.agentId);
  const orgId = req.user!.organizationId;

  const team = await db.select().from(teamsTable).where(and(eq(teamsTable.id, teamId), eq(teamsTable.organizationId, orgId))).limit(1);
  if (!team[0]) return res.status(404).json({ error: "Team not found" });

  await db.delete(teamAgentsTable).where(and(eq(teamAgentsTable.teamId, teamId), eq(teamAgentsTable.agentId, agentId)));
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// WORKFORCE GRAPH — Full org tree query
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/workforce/graph
router.get("/api/workforce/graph", async (req, res) => {
  const orgId = req.user!.organizationId;

  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
  const departments = await db.select().from(departmentsTable).where(eq(departmentsTable.organizationId, orgId));
  const teams = await db.select().from(teamsTable).where(eq(teamsTable.organizationId, orgId));
  const teamAgents = await db.select().from(teamAgentsTable)
    .innerJoin(teamsTable, eq(teamAgentsTable.teamId, teamsTable.id))
    .where(eq(teamsTable.organizationId, orgId));
  const deptAgents = await db.select().from(departmentAgentsTable)
    .innerJoin(departmentsTable, eq(departmentAgentsTable.departmentId, departmentsTable.id))
    .where(eq(departmentsTable.organizationId, orgId));
  const agents = await db.select().from(agentsTable).where(eq(agentsTable.organizationId, orgId));

  const agentMap: Record<number, typeof agents[0]> = {};
  for (const a of agents) agentMap[a.id] = a;

  const deptGraph = departments.map((dept) => {
    const dAgents = deptAgents
      .filter((da) => da.department_agents.departmentId === dept.id)
      .map((da) => agentMap[da.department_agents.agentId]);
    const dTeams = teams.filter((t) => t.departmentId === dept.id).map((team) => {
      const tAgents = teamAgents
        .filter((ta) => ta.team_agents.teamId === team.id)
        .map((ta) => agentMap[ta.team_agents.agentId]);
      return { ...team, agents: tAgents.filter(Boolean) };
    });
    return { ...dept, agents: dAgents.filter(Boolean), teams: dTeams };
  });

  res.json({
    graph: {
      organization: org,
      departments: deptGraph,
      stats: {
        totalDepartments: departments.length,
        totalTeams: teams.length,
        totalAgents: agents.length,
      },
    },
  });
});

// GET /api/workforce/graph/agent/:id — find all relationships for an agent
router.get("/api/workforce/graph/agent/:id", async (req, res) => {
  const agentId = Number(req.params.id);
  const orgId = req.user!.organizationId;

  const [agent] = await db.select().from(agentsTable)
    .where(and(eq(agentsTable.id, agentId), eq(agentsTable.organizationId, orgId))).limit(1);
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  const agentTeams = await db.select().from(teamAgentsTable)
    .innerJoin(teamsTable, eq(teamAgentsTable.teamId, teamsTable.id))
    .where(and(eq(teamAgentsTable.agentId, agentId), eq(teamsTable.organizationId, orgId)));

  const agentDepts = await db.select().from(departmentAgentsTable)
    .innerJoin(departmentsTable, eq(departmentAgentsTable.departmentId, departmentsTable.id))
    .where(and(eq(departmentAgentsTable.agentId, agentId), eq(departmentsTable.organizationId, orgId)));

  res.json({
    agent,
    teams: agentTeams.map((r) => r.teams),
    departments: agentDepts.map((r) => r.departments),
  });
});

export default router;
