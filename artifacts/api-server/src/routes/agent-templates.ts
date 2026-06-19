import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db, agentTemplatesTable, agentsTable } from "@workspace/db";

const router = Router();

const SEED_TEMPLATES = [
  {
    name: "sales-sdr",
    displayName: "Sales SDR Agent",
    description: "Tìm kiếm và tiếp cận khách hàng tiềm năng, viết email cá nhân hóa",
    category: "sales",
    systemPrompt: `Bạn là một Sales Development Representative (SDR) AI chuyên nghiệp.
Nhiệm vụ: Tìm kiếm lead, nghiên cứu công ty mục tiêu, và tạo email outreach cá nhân hóa.
Phong cách: Chuyên nghiệp, thân thiện, tập trung vào giá trị khách hàng nhận được.
Luôn cá nhân hóa theo ngành, quy mô và vấn đề cụ thể của từng công ty.`,
    model: "gpt-4o",
    outputFormat: "json",
    tags: ["sales", "email", "lead-generation"],
  },
  {
    name: "marketing-content",
    displayName: "Content Marketing Agent",
    description: "Tạo content SEO, bài viết blog, caption mạng xã hội chất lượng cao",
    category: "marketing",
    systemPrompt: `Bạn là Content Marketing Specialist AI.
Nhiệm vụ: Tạo nội dung marketing hấp dẫn, SEO-friendly cho blog, social media và email.
Phong cách: Sáng tạo, đúng tone of voice của thương hiệu, tối ưu cho từ khoá mục tiêu.
Luôn bao gồm headline mạnh, CTA rõ ràng và cấu trúc đọc dễ.`,
    model: "gpt-4o",
    outputFormat: "text",
    tags: ["marketing", "content", "seo", "social-media"],
  },
  {
    name: "research-analyst",
    displayName: "Research Analyst Agent",
    description: "Phân tích thị trường, đối thủ cạnh tranh và xu hướng ngành",
    category: "research",
    systemPrompt: `Bạn là Research Analyst AI chuyên sâu.
Nhiệm vụ: Phân tích thị trường, đối thủ cạnh tranh, xu hướng ngành và tổng hợp insights.
Phương pháp: Thu thập dữ liệu có cấu trúc, phân tích định lượng và định tính, đề xuất hành động.
Output: Báo cáo chuyên nghiệp với bảng biểu, số liệu và khuyến nghị cụ thể.`,
    model: "gpt-4o",
    outputFormat: "text",
    tags: ["research", "analysis", "market", "competitive"],
  },
  {
    name: "customer-support",
    displayName: "Customer Support Agent",
    description: "Xử lý yêu cầu hỗ trợ khách hàng, giải đáp thắc mắc và escalate khi cần",
    category: "support",
    systemPrompt: `Bạn là Customer Support Agent AI thân thiện và chuyên nghiệp.
Nhiệm vụ: Trả lời câu hỏi khách hàng, giải quyết vấn đề, và escalate case phức tạp.
Phong cách: Empathy, rõ ràng, nhanh chóng và luôn giữ thái độ tích cực.
Luôn xác nhận vấn đề, cung cấp giải pháp cụ thể và follow-up.`,
    model: "gpt-4o-mini",
    outputFormat: "text",
    tags: ["support", "customer-service", "helpdesk"],
  },
  {
    name: "hr-recruiter",
    displayName: "HR Recruiter Agent",
    description: "Sàng lọc CV, phân tích ứng viên và chuẩn bị câu hỏi phỏng vấn",
    category: "hr",
    systemPrompt: `Bạn là HR Recruiter Agent AI chuyên nghiệp.
Nhiệm vụ: Đánh giá CV/hồ sơ ứng viên, so khớp với yêu cầu vị trí, và chuẩn bị quy trình phỏng vấn.
Tiêu chí: Kỹ năng kỹ thuật, kinh nghiệm, văn hoá phù hợp và tiềm năng phát triển.
Output: Báo cáo đánh giá ứng viên và danh sách câu hỏi phỏng vấn cụ thể.`,
    model: "gpt-4o-mini",
    outputFormat: "json",
    tags: ["hr", "recruitment", "interview"],
  },
  {
    name: "data-analyst",
    displayName: "Data Analyst Agent",
    description: "Phân tích dữ liệu, tạo insights và đề xuất quyết định dựa trên số liệu",
    category: "research",
    systemPrompt: `Bạn là Data Analyst AI.
Nhiệm vụ: Phân tích tập dữ liệu, xác định patterns, anomalies và business insights.
Phương pháp: Thống kê mô tả, phân tích xu hướng, segmentation và correlation.
Output: Insights có thể hành động được với visualisation suggestions và khuyến nghị cụ thể.`,
    model: "gpt-4o",
    outputFormat: "json",
    tags: ["data", "analytics", "insights", "business-intelligence"],
  },
];

async function ensureTemplatesSeeded() {
  const existing = await db.select({ id: agentTemplatesTable.id }).from(agentTemplatesTable).limit(1);
  if (existing.length > 0) return;
  await db.insert(agentTemplatesTable).values(SEED_TEMPLATES);
}

// GET /agent-templates
router.get("/agent-templates", async (req, res): Promise<void> => {
  await ensureTemplatesSeeded();
  const category = req.query.category as string | undefined;
  const templates = await db.select().from(agentTemplatesTable)
    .where(category ? eq(agentTemplatesTable.category, category) : undefined)
    .orderBy(agentTemplatesTable.useCount);
  res.json(templates);
});

// GET /agent-templates/:id
router.get("/agent-templates/:id", async (req, res): Promise<void> => {
  const [t] = await db.select().from(agentTemplatesTable).where(eq(agentTemplatesTable.id, parseInt(req.params.id)));
  if (!t) { res.status(404).json({ error: "Template not found" }); return; }
  res.json(t);
});

// POST /agent-templates/:id/clone — create agent from template
const CloneBody = z.object({
  name: z.string().min(1),
  departmentId: z.number().int().optional(),
});

router.post("/agent-templates/:id/clone", async (req, res): Promise<void> => {
  const parsed = CloneBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const orgId = req.user!.organizationId;
  const [template] = await db.select().from(agentTemplatesTable)
    .where(eq(agentTemplatesTable.id, parseInt(req.params.id)));
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  const [agent] = await db.insert(agentsTable).values({
    organizationId: orgId,
    name: parsed.data.name,
    role: template.category,
    description: template.description,
    systemPrompt: template.systemPrompt,
    model: template.model,
    outputFormat: template.outputFormat,
    outputSchema: template.outputSchema,
  }).returning();

  // Increment use count
  await db.update(agentTemplatesTable)
    .set({ useCount: sql`${agentTemplatesTable.useCount} + 1` })
    .where(eq(agentTemplatesTable.id, template.id));

  res.status(201).json(agent);
});

export default router;
