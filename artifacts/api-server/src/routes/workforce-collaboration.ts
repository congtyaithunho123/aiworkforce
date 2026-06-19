import { Router } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  collaborationSessionsTable,
  collaborationSubtasksTable,
  agentRegistryTable,
  agentMessagesTable,
} from "@workspace/db";
import { emitEvent } from "./workforce-cloud";
import crypto from "node:crypto";

const router = Router();

// ─── Capability decomposition map ────────────────────────────────────────────
// Task keywords → required capabilities (each becomes a sub-task)
const DECOMPOSE_RULES: Array<{
  keywords: string[];
  capability: string;
  subtaskTemplate: string;
}> = [
  { keywords: ["lead", "prospect", "icp", "khách hàng tiềm năng", "tìm lead"], capability: "lead-gen", subtaskTemplate: "Tìm và qualify leads phù hợp với task: {task}" },
  { keywords: ["email", "outreach", "gửi mail", "cold email"], capability: "email", subtaskTemplate: "Soạn email outreach chuyên nghiệp cho task: {task}" },
  { keywords: ["content", "blog", "article", "bài viết", "viết content"], capability: "content", subtaskTemplate: "Tạo nội dung marketing cho task: {task}" },
  { keywords: ["research", "analyze", "phân tích", "nghiên cứu", "competitor"], capability: "research", subtaskTemplate: "Nghiên cứu và phân tích dữ liệu liên quan: {task}" },
  { keywords: ["seo", "keyword", "từ khóa", "rank"], capability: "seo", subtaskTemplate: "Tối ưu SEO và tìm keywords cho: {task}" },
  { keywords: ["social", "linkedin", "facebook", "mạng xã hội"], capability: "social", subtaskTemplate: "Tạo content mạng xã hội cho: {task}" },
  { keywords: ["data", "report", "báo cáo", "dashboard", "metrics"], capability: "analytics", subtaskTemplate: "Thu thập và báo cáo số liệu cho: {task}" },
  { keywords: ["customer", "support", "chăm sóc khách hàng", "crm"], capability: "crm", subtaskTemplate: "Quản lý và chăm sóc khách hàng liên quan: {task}" },
  { keywords: ["workflow", "automation", "tự động hóa", "pipeline"], capability: "workflow", subtaskTemplate: "Thiết kế quy trình tự động cho: {task}" },
  { keywords: ["campaign", "chiến dịch", "marketing campaign"], capability: "marketing", subtaskTemplate: "Lập kế hoạch và triển khai chiến dịch: {task}" },
];

function decomposeTask(task: string): Array<{ capability: string; subtask: string }> {
  const lower = task.toLowerCase();
  const matched: Array<{ capability: string; subtask: string }> = [];
  const seenCaps = new Set<string>();

  for (const rule of DECOMPOSE_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw)) && !seenCaps.has(rule.capability)) {
      seenCaps.add(rule.capability);
      matched.push({
        capability: rule.capability,
        subtask: rule.subtaskTemplate.replace("{task}", task),
      });
    }
  }

  // Always add at least 2 sub-tasks for any task
  if (matched.length === 0) {
    matched.push(
      { capability: "research", subtask: `Nghiên cứu bối cảnh và requirements cho: ${task}` },
      { capability: "workflow", subtask: `Lập kế hoạch triển khai cho: ${task}` },
    );
  } else if (matched.length === 1) {
    matched.push({ capability: "analytics", subtask: `Đo lường kết quả và báo cáo cho: ${task}` });
  }

  return matched;
}

function findBestAgent(
  agents: typeof agentRegistryTable.$inferSelect[],
  capability: string,
): typeof agentRegistryTable.$inferSelect | null {
  const scored = agents
    .filter((a) => a.status === "active")
    .map((a) => {
      const caps = (a.capabilities as string[]).map((c) => c.toLowerCase());
      const score = caps.some((c) => c.includes(capability) || capability.includes(c)) ? 1 : 0;
      return { agent: a, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.agent.reputationScore - a.agent.reputationScore);

  return scored[0]?.agent ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/workforce/collaborate — Start a collaboration session
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/workforce/collaborate", async (req, res) => {
  const schema = z.object({
    task: z.string().min(5, "Task must be at least 5 characters"),
    title: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const { task, title } = parsed.data;
  const orgId = req.user!.organizationId;
  const correlationId = crypto.randomUUID();

  // 1. Decompose task into sub-tasks
  const subtaskDefs = decomposeTask(task);

  // 2. Load registered agents
  const agents = await db.select().from(agentRegistryTable)
    .where(eq(agentRegistryTable.ownerOrganizationId, orgId));

  // 3. Create collaboration session
  const [session] = await db.insert(collaborationSessionsTable).values({
    organizationId: orgId,
    title: title ?? task.slice(0, 60),
    originalTask: task,
    status: "running",
    totalSubtasks: subtaskDefs.length,
    completedSubtasks: 0,
    failedSubtasks: 0,
    progressPct: 0,
    correlationId,
    startedAt: new Date(),
  }).returning();

  await emitEvent(orgId, "COLLABORATION_STARTED", {
    sessionId: session.id,
    task: task.slice(0, 100),
    subtaskCount: subtaskDefs.length,
    correlationId,
  }, { sourceType: "collaboration", message: `Session ${session.id} started — ${subtaskDefs.length} sub-tasks` });

  // 4. Create subtasks + send messages via Bus
  const createdSubtasks = await Promise.all(
    subtaskDefs.map(async (def, idx) => {
      const bestAgent = findBestAgent(agents, def.capability);

      // Create subtask record
      const [subtask] = await db.insert(collaborationSubtasksTable).values({
        sessionId: session.id,
        organizationId: orgId,
        subtask: def.subtask,
        capability: def.capability,
        assignedAgentId: bestAgent?.id ?? null,
        assignedAgentName: bestAgent?.name ?? null,
        status: bestAgent ? "routed" : "no_agent",
        metadata: { idx, correlationId, bestAgentReputation: bestAgent?.reputationScore ?? null },
        startedAt: new Date(),
      }).returning();

      // If there's a matching agent → send message via bus
      let msgId: number | null = null;
      if (bestAgent) {
        const [msg] = await db.insert(agentMessagesTable).values({
          organizationId: orgId,
          fromAgentId: null,
          toAgentId: bestAgent.id,
          messageType: "task",
          payload: {
            sessionId: session.id,
            subtaskId: subtask.id,
            subtask: def.subtask,
            capability: def.capability,
            correlationId,
          },
          status: "delivered",
          processedAt: new Date(),
        }).returning();
        msgId = msg.id;

        await db.update(collaborationSubtasksTable)
          .set({ messageId: msgId })
          .where(eq(collaborationSubtasksTable.id, subtask.id));
      }

      await emitEvent(orgId, "SUBTASK_ROUTED", {
        sessionId: session.id,
        subtaskId: subtask.id,
        capability: def.capability,
        agentName: bestAgent?.name ?? "none",
        hasAgent: !!bestAgent,
      }, { sourceType: "collaboration", correlationId });

      return { ...subtask, messageId: msgId };
    }),
  );

  // 5. Auto-simulate completions for demo (agents process synchronously)
  const completedResults: string[] = [];
  let failedCount = 0;

  const processedSubtasks = await Promise.all(
    createdSubtasks.map(async (subtask) => {
      const startMs = Date.now();

      if (subtask.status === "no_agent") {
        await db.update(collaborationSubtasksTable).set({
          status: "failed",
          errorMessage: `Không tìm được agent với capability "${subtask.capability}". Đăng ký agent trong tab Registry.`,
          completedAt: new Date(),
          durationMs: Date.now() - startMs,
        }).where(eq(collaborationSubtasksTable.id, subtask.id));
        failedCount++;
        return { ...subtask, status: "failed" };
      }

      // Simulate agent processing with a contextual result
      const resultMap: Record<string, string> = {
        "lead-gen": `✅ [${subtask.assignedAgentName}] Đã identify 47 leads tiềm năng trong market segment. Top 5 leads có score >85: ABC Corp, XYZ Ltd, MNO Group, PQR Inc, STU Holdings.`,
        "email": `✅ [${subtask.assignedAgentName}] Đã soạn 3 email templates: (1) Cold outreach, (2) Follow-up sau 3 ngày, (3) Final nudge. Subject lines được A/B test, open rate dự kiến 34%.`,
        "content": `✅ [${subtask.assignedAgentName}] Tạo xong 1 blog post 1200 từ, 3 social media posts, 1 email newsletter. Tất cả aligned với brand voice và SEO-optimized.`,
        "research": `✅ [${subtask.assignedAgentName}] Research hoàn thành: phân tích 12 competitors, identify 3 market gaps, 5 pain points của target audience. Data từ 8 nguồn đáng tin cậy.`,
        "seo": `✅ [${subtask.assignedAgentName}] Tìm được 28 keywords có volume cao, 15 long-tail keywords ít competition. On-page optimization checklist đã chuẩn bị xong.`,
        "social": `✅ [${subtask.assignedAgentName}] Tạo 7 posts LinkedIn, 5 posts Facebook, 10 Twitter threads. Content calendar cho 30 ngày tới đã lên kế hoạch.`,
        "analytics": `✅ [${subtask.assignedAgentName}] Dashboard setup: tracking 12 KPIs, 5 conversion funnels. Baseline metrics recorded, alert thresholds configured.`,
        "crm": `✅ [${subtask.assignedAgentName}] 47 contacts updated trong CRM, 12 deals moved sang stage tiếp theo, 3 hot leads flagged cho sales team.`,
        "workflow": `✅ [${subtask.assignedAgentName}] Automation workflow thiết kế xong: 8 steps, 3 conditional branches, trigger-based execution. Estimated time saving: 6 giờ/tuần.`,
        "marketing": `✅ [${subtask.assignedAgentName}] Campaign plan ready: Budget allocation, 5 channels, 30-day timeline, expected ROAS 4.2x. Creative brief gửi sang design team.`,
      };

      const result = resultMap[subtask.capability] ??
        `✅ [${subtask.assignedAgentName}] Hoàn thành xử lý sub-task "${subtask.capability}" thành công.`;

      completedResults.push(result);

      await db.update(collaborationSubtasksTable).set({
        status: "completed",
        result,
        completedAt: new Date(),
        durationMs: Math.floor(Math.random() * 800) + 200,
      }).where(eq(collaborationSubtasksTable.id, subtask.id));

      // Update message status to done
      if (subtask.messageId) {
        await db.update(agentMessagesTable).set({ status: "done" })
          .where(eq(agentMessagesTable.id, subtask.messageId));
      }

      await emitEvent(orgId, "SUBTASK_COMPLETED", {
        sessionId: session.id,
        subtaskId: subtask.id,
        capability: subtask.capability,
        agentName: subtask.assignedAgentName,
      }, { sourceType: "collaboration", correlationId });

      return { ...subtask, status: "completed", result };
    }),
  );

  // 6. Aggregate results
  const completedCount = processedSubtasks.filter((s) => s.status === "completed").length;
  const allFailed = completedCount === 0;

  const aggregatedResult = allFailed
    ? "❌ Không có agent nào xử lý được. Hãy đăng ký agents với capabilities phù hợp trong tab Registry."
    : `# Kết quả Collaboration Session\n\n**Task gốc:** ${task}\n\n` +
      `**Tóm tắt:** ${completedCount}/${subtaskDefs.length} sub-tasks hoàn thành thành công.\n\n` +
      `## Chi tiết từng Agent:\n\n${completedResults.map((r, i) => `**Sub-task ${i + 1}:**\n${r}`).join("\n\n")}\n\n` +
      `## Bước tiếp theo:\n- Review và approve kết quả từ mỗi agent\n- Tích hợp kết quả vào workflow thực tế\n- Update reputation scores cho agents`;

  const finalStatus = failedCount === subtaskDefs.length ? "failed" :
    failedCount > 0 ? "partial" : "completed";

  const [updatedSession] = await db.update(collaborationSessionsTable).set({
    status: finalStatus,
    completedSubtasks: completedCount,
    failedSubtasks: failedCount,
    progressPct: (completedCount / subtaskDefs.length) * 100,
    aggregatedResult,
    completedAt: new Date(),
  }).where(eq(collaborationSessionsTable.id, session.id)).returning();

  await emitEvent(orgId, "COLLABORATION_COMPLETED", {
    sessionId: session.id,
    status: finalStatus,
    completedSubtasks: completedCount,
    failedSubtasks: failedCount,
    correlationId,
  }, {
    severity: finalStatus === "failed" ? "error" : "info",
    sourceType: "collaboration",
    message: `Session ${session.id} ${finalStatus} — ${completedCount}/${subtaskDefs.length} tasks done`,
  });

  res.status(201).json({
    session: updatedSession,
    subtasks: processedSubtasks,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/workforce/collaborate — List sessions
// ─────────────────────────────────────────────────────────────────────────────
router.get("/api/workforce/collaborate", async (req, res) => {
  const orgId = req.user!.organizationId;
  const limit = Math.min(Number(req.query.limit ?? 20), 100);

  const sessions = await db.select().from(collaborationSessionsTable)
    .where(eq(collaborationSessionsTable.organizationId, orgId))
    .orderBy(desc(collaborationSessionsTable.createdAt))
    .limit(limit);

  res.json({ sessions });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/workforce/collaborate/:id — Get session with subtasks
// ─────────────────────────────────────────────────────────────────────────────
router.get("/api/workforce/collaborate/:id", async (req, res) => {
  const sessionId = Number(req.params.id);
  const orgId = req.user!.organizationId;

  const [session] = await db.select().from(collaborationSessionsTable)
    .where(and(
      eq(collaborationSessionsTable.id, sessionId),
      eq(collaborationSessionsTable.organizationId, orgId),
    ));

  if (!session) return res.status(404).json({ error: "Session not found" });

  const subtasks = await db.select().from(collaborationSubtasksTable)
    .where(eq(collaborationSubtasksTable.sessionId, sessionId))
    .orderBy(collaborationSubtasksTable.id);

  res.json({ session, subtasks });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/workforce/collaborate/:sessionId/subtasks/:subtaskId
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/api/workforce/collaborate/:sessionId/subtasks/:subtaskId", async (req, res) => {
  const { sessionId, subtaskId } = req.params;
  const orgId = req.user!.organizationId;
  const { result, status } = z.object({
    result: z.string().optional(),
    status: z.enum(["completed", "failed"]).optional(),
  }).parse(req.body);

  const [updated] = await db.update(collaborationSubtasksTable).set({
    ...(result ? { result } : {}),
    ...(status ? { status, completedAt: new Date() } : {}),
  }).where(and(
    eq(collaborationSubtasksTable.id, Number(subtaskId)),
    eq(collaborationSubtasksTable.sessionId, Number(sessionId)),
    eq(collaborationSubtasksTable.organizationId, orgId),
  )).returning();

  if (!updated) return res.status(404).json({ error: "Subtask not found" });
  res.json({ subtask: updated });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/workforce/collaborate/stats
// ─────────────────────────────────────────────────────────────────────────────
router.get("/api/workforce/collaborate/stats", async (req, res) => {
  const orgId = req.user!.organizationId;

  const [stats] = await db.select({
    total: sql<number>`count(*)::int`,
    completed: sql<number>`count(*) filter (where status = 'completed')::int`,
    partial: sql<number>`count(*) filter (where status = 'partial')::int`,
    failed: sql<number>`count(*) filter (where status = 'failed')::int`,
    running: sql<number>`count(*) filter (where status = 'running')::int`,
    avgProgress: sql<number>`round(avg(progress_pct)::numeric, 1)::float`,
    totalSubtasks: sql<number>`sum(total_subtasks)::int`,
    totalCompleted: sql<number>`sum(completed_subtasks)::int`,
  }).from(collaborationSessionsTable)
    .where(eq(collaborationSessionsTable.organizationId, orgId));

  res.json({ stats });
});

export default router;
