import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db, workflowTemplatesTable, workflowsTable } from "@workspace/db";

const router = Router();

const SEED_TEMPLATES = [
  {
    name: "lead-generation",
    displayName: "Lead Generation Workflow",
    description: "Tự động tìm kiếm lead, nghiên cứu công ty và tạo email outreach cá nhân hóa",
    category: "sales",
    estimatedMinutes: 8,
    tags: ["sales", "lead", "email"],
    steps: [
      { name: "Company Research", agentRole: "Lead Research Agent", prompt: "Nghiên cứu công ty {company} — ngành, quy mô, vấn đề kinh doanh, người quyết định", outputFormat: "json" as const },
      { name: "Lead Scoring", agentRole: "Sales SDR Agent", prompt: "Dựa trên research trên, chấm điểm lead từ 0-100 và giải thích", outputFormat: "json" as const },
      { name: "Personalized Email", agentRole: "Outreach Agent", prompt: "Viết email outreach cá nhân hóa dựa trên research và điểm lead", outputFormat: "text" as const },
      { name: "Follow-up Sequence", agentRole: "Follow-up Agent", prompt: "Tạo chuỗi 3 email follow-up nếu không nhận được phản hồi", outputFormat: "text" as const },
    ],
  },
  {
    name: "content-marketing",
    displayName: "Content Marketing Workflow",
    description: "Nghiên cứu từ khoá, tạo content SEO, và lịch đăng bài tự động",
    category: "marketing",
    estimatedMinutes: 12,
    tags: ["marketing", "content", "seo"],
    steps: [
      { name: "Keyword Research", agentRole: "Research Agent", prompt: "Nghiên cứu từ khoá cho chủ đề '{topic}' — tìm top 10 từ khoá có search volume cao, competition thấp", outputFormat: "json" as const },
      { name: "Content Strategy", agentRole: "Marketing Strategist", prompt: "Dựa trên từ khoá trên, tạo content calendar 4 tuần với tiêu đề và outline bài viết", outputFormat: "json" as const },
      { name: "Write Article", agentRole: "Content Writer Agent", prompt: "Viết bài blog 1500 từ, SEO-optimized cho từ khoá chính, bao gồm H2/H3, meta description", outputFormat: "text" as const },
      { name: "Social Media Adaptation", agentRole: "Social Media Agent", prompt: "Tạo phiên bản rút gọn cho LinkedIn, Facebook, Twitter từ bài blog vừa viết", outputFormat: "text" as const },
    ],
  },
  {
    name: "cold-email",
    displayName: "Cold Email Campaign",
    description: "Xây dựng chiến dịch cold email từ đầu đến cuối cho một ICP cụ thể",
    category: "sales",
    estimatedMinutes: 10,
    tags: ["sales", "email", "campaign"],
    steps: [
      { name: "ICP Definition", agentRole: "Sales Strategist", prompt: "Định nghĩa Ideal Customer Profile (ICP) cho {product} — ngành, quy mô, pain points, personas", outputFormat: "json" as const },
      { name: "Email Sequences", agentRole: "Copywriter Agent", prompt: "Viết 5 email sequence cho ICP trên: welcome, value, social proof, urgency, final CTA", outputFormat: "json" as const },
      { name: "A/B Test Variants", agentRole: "Marketing Agent", prompt: "Tạo 2 biến thể subject line và opening cho email đầu tiên để A/B test", outputFormat: "json" as const },
    ],
  },
  {
    name: "market-research",
    displayName: "Market Research Report",
    description: "Phân tích thị trường toàn diện: TAM, đối thủ, xu hướng và cơ hội",
    category: "research",
    estimatedMinutes: 15,
    tags: ["research", "market", "analysis"],
    steps: [
      { name: "Market Size Analysis", agentRole: "Research Analyst Agent", prompt: "Phân tích thị trường {market} — TAM, SAM, SOM, tốc độ tăng trưởng 5 năm gần nhất", outputFormat: "text" as const },
      { name: "Competitive Analysis", agentRole: "Research Analyst Agent", prompt: "Liệt kê và so sánh top 5 đối thủ cạnh tranh: giá, features, positioning, điểm mạnh/yếu", outputFormat: "json" as const },
      { name: "Trend Analysis", agentRole: "Data Analyst Agent", prompt: "Xác định 5 xu hướng lớn sẽ định hình thị trường trong 2-3 năm tới", outputFormat: "text" as const },
      { name: "Opportunity Report", agentRole: "Business Strategist", prompt: "Tổng hợp nghiên cứu trên thành báo cáo cơ hội: 3 recommendation ưu tiên cao nhất", outputFormat: "text" as const },
    ],
  },
];

async function ensureTemplatesSeeded() {
  const existing = await db.select({ id: workflowTemplatesTable.id }).from(workflowTemplatesTable).limit(1);
  if (existing.length > 0) return;
  await db.insert(workflowTemplatesTable).values(SEED_TEMPLATES);
}

// GET /workflow-templates
router.get("/workflow-templates", async (req, res): Promise<void> => {
  await ensureTemplatesSeeded();
  const category = req.query.category as string | undefined;
  const templates = await db.select().from(workflowTemplatesTable)
    .where(category ? eq(workflowTemplatesTable.category, category) : undefined);
  res.json(templates);
});

// GET /workflow-templates/:id
router.get("/workflow-templates/:id", async (req, res): Promise<void> => {
  const [t] = await db.select().from(workflowTemplatesTable)
    .where(eq(workflowTemplatesTable.id, parseInt(req.params.id)));
  if (!t) { res.status(404).json({ error: "Template not found" }); return; }
  res.json(t);
});

// POST /workflow-templates/:id/import — create workflow from template
const ImportBody = z.object({ name: z.string().min(1) });

router.post("/workflow-templates/:id/import", async (req, res): Promise<void> => {
  const parsed = ImportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const orgId = req.user!.organizationId;
  const [template] = await db.select().from(workflowTemplatesTable)
    .where(eq(workflowTemplatesTable.id, parseInt(req.params.id)));
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  // Build step description to embed in workflow description
  const stepsDesc = (template.steps ?? [])
    .map((s, i) => `${i + 1}. ${s.name} — ${s.agentRole}`)
    .join("\n");

  const [workflow] = await db.insert(workflowsTable).values({
    organizationId: orgId,
    name: parsed.data.name,
    description: `${template.description}\n\nBước:\n${stepsDesc}`,
  }).returning();

  await db.update(workflowTemplatesTable)
    .set({ useCount: sql`${workflowTemplatesTable.useCount} + 1` })
    .where(eq(workflowTemplatesTable.id, template.id));

  res.status(201).json({ workflow, templateSteps: template.steps ?? [] });
});

export default router;
