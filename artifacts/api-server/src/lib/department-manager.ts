import { eq, inArray } from "drizzle-orm";
import {
  db,
  departmentsTable,
  departmentAgentsTable,
  agentsTable,
  tasksTable,
} from "@workspace/db";
import { runCompletion, estimateCost } from "./ai-service";
import { logger } from "./logger";

export type DepartmentTaskResult = {
  departmentId: number;
  departmentName: string;
  agentId: number;
  agentName: string;
  input: string;
  output: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  durationMs: number;
};

export type DepartmentRunResult = {
  departmentId: number;
  departmentName: string;
  userRequest: string;
  agentResults: DepartmentTaskResult[];
  finalReport: string;
  totalTokens: number;
  totalCost: number;
  durationMs: number;
};

function parseCapabilities(capabilitiesJson: string | null): string[] {
  if (!capabilitiesJson) return [];
  try {
    const parsed = JSON.parse(capabilitiesJson);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function routeToAgent(
  agents: Array<{ id: number; name: string; role: string; capabilities: string | null }>,
  requiredCapability: string,
): Promise<typeof agents[0] | null> {
  const match = agents.find((a) => {
    const caps = parseCapabilities(a.capabilities);
    return (
      caps.includes(requiredCapability) ||
      a.role.toLowerCase().includes(requiredCapability.toLowerCase())
    );
  });
  return match ?? agents[0] ?? null;
}

export async function runDepartment(
  departmentId: number,
  userRequest: string,
): Promise<DepartmentRunResult> {
  const startedAt = new Date();

  const [dept] = await db
    .select()
    .from(departmentsTable)
    .where(eq(departmentsTable.id, departmentId));

  if (!dept) throw new Error(`Department ${departmentId} not found`);

  const deptAgentLinks = await db
    .select()
    .from(departmentAgentsTable)
    .where(eq(departmentAgentsTable.departmentId, departmentId));

  if (deptAgentLinks.length === 0) {
    throw new Error(`Department "${dept.name}" has no agents assigned`);
  }

  const agentIds = deptAgentLinks.map((da) => da.agentId);
  const agents = await db
    .select()
    .from(agentsTable)
    .where(inArray(agentsTable.id, agentIds));

  logger.info(
    { departmentId, departmentName: dept.name, agentCount: agents.length },
    "Department run started",
  );

  const plannerPrompt = `Bạn là Department Manager của ${dept.name}.

Yêu cầu người dùng: ${userRequest}

Danh sách agents có sẵn:
${agents.map((a) => `- ${a.name} (role: ${a.role}, capabilities: ${parseCapabilities(a.capabilities).join(", ") || "general"})`).join("\n")}

Hãy phân tích yêu cầu và tạo kế hoạch công việc. Trả về JSON:
{
  "assignments": [
    { "agentId": <id>, "task": "<nhiệm vụ cụ thể>" }
  ]
}`;

  const planResult = await runCompletion(
    [
      { role: "system", content: "Bạn là AI Department Manager. Phân tích và phân công công việc cho các agents." },
      { role: "user", content: plannerPrompt },
    ],
    { model: "gpt-4o", outputFormat: "json" },
  );

  let assignments: Array<{ agentId: number; task: string }> = [];
  try {
    const parsed = JSON.parse(planResult.content) as {
      assignments?: Array<{ agentId: number; task: string }>;
    };
    assignments = parsed.assignments ?? [];
  } catch {
    assignments = agents.slice(0, 2).map((a) => ({ agentId: a.id, task: userRequest }));
  }

  const agentResults: DepartmentTaskResult[] = [];
  let totalTokens = planResult.totalTokens;
  let totalCost = estimateCost(planResult.model, planResult.promptTokens, planResult.completionTokens);

  for (const assignment of assignments) {
    const agent = agents.find((a) => a.id === assignment.agentId);
    if (!agent) continue;

    const stepStart = new Date();
    try {
      const result = await runCompletion(
        [
          { role: "system", content: agent.systemPrompt },
          { role: "user", content: assignment.task },
        ],
        {
          model: agent.model,
          outputFormat: (agent.outputFormat as "text" | "json") ?? "text",
        },
      );

      const stepMs = new Date().getTime() - stepStart.getTime();
      const stepCost = estimateCost(result.model, result.promptTokens, result.completionTokens);
      totalTokens += result.totalTokens;
      totalCost += stepCost;

      agentResults.push({
        departmentId,
        departmentName: dept.name,
        agentId: agent.id,
        agentName: agent.name,
        input: assignment.task,
        output: result.content,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        cost: stepCost,
        durationMs: stepMs,
      });

      logger.info({ agentId: agent.id, agentName: agent.name, stepMs }, "Agent task completed");
    } catch (err) {
      logger.error({ agentId: agent.id, error: String(err) }, "Agent task failed");
      agentResults.push({
        departmentId,
        departmentName: dept.name,
        agentId: agent.id,
        agentName: agent.name,
        input: assignment.task,
        output: `Error: ${String(err)}`,
        promptTokens: 0,
        completionTokens: 0,
        cost: 0,
        durationMs: 0,
      });
    }
  }

  const summaryContext = agentResults
    .map((r, i) => `### Agent ${i + 1}: ${r.agentName}\n**Task:** ${r.input}\n**Result:** ${r.output}`)
    .join("\n\n");

  const summaryResult = await runCompletion(
    [
      {
        role: "system",
        content: `Bạn là Department Manager của ${dept.name}. Tổng hợp kết quả từ các agents thành báo cáo cuối cùng ngắn gọn và actionable bằng tiếng Việt.`,
      },
      {
        role: "user",
        content: `Yêu cầu gốc: ${userRequest}\n\nKết quả từ agents:\n\n${summaryContext}`,
      },
    ],
    { model: "gpt-4o-mini", outputFormat: "text" },
  );

  totalTokens += summaryResult.totalTokens;
  totalCost += estimateCost(summaryResult.model, summaryResult.promptTokens, summaryResult.completionTokens);

  const durationMs = new Date().getTime() - startedAt.getTime();

  logger.info(
    { departmentId, durationMs, totalTokens, totalCost, agentCount: agentResults.length },
    "Department run completed",
  );

  return {
    departmentId,
    departmentName: dept.name,
    userRequest,
    agentResults,
    finalReport: summaryResult.content,
    totalTokens,
    totalCost,
    durationMs,
  };
}
