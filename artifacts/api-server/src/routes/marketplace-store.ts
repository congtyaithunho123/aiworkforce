import { Router } from "express";
import { eq, and, ilike, or, sql, desc, asc, count, avg } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  marketplaceAgentsTable,
  marketplaceWorkflowsTable,
  reviewsTable,
  creatorPayoutsTable,
  usersTable,
  organizationsTable,
  agentsTable,
  workflowsTable,
  workflowStepsTable,
} from "@workspace/db";

const router = Router();

// ── Seed data ────────────────────────────────────────────────────────────────

const SEED_AGENTS = [
  {
    name: "ai-sdr-team-lead",
    displayName: "AI SDR Team Lead",
    description: "Agent chuyên phân tích thị trường, xác định ICP và điều phối toàn bộ quy trình sales.",
    longDescription: "Agent SDR Team Lead tự động phân tích website khách hàng, xây dựng ICP, tạo lead list, và điều phối 4 agents phụ để thực hiện outreach campaign hoàn chỉnh.",
    category: "sales",
    tags: ["sdr", "lead-gen", "outreach", "icp"],
    model: "gpt-4o",
    systemPrompt: "Bạn là Sales Development Representative AI chuyên nghiệp...",
    tools: ["web_search", "email_writer", "crm_updater"],
    version: "2.0.0",
    status: "published",
    isVerified: true,
    isFeatured: true,
    iconEmoji: "🎯",
    installCount: 342,
    activeInstalls: 218,
    executionCount: 4821,
    revenueSharePct: 70,
  },
  {
    name: "content-marketing-ai",
    displayName: "Content Marketing AI",
    description: "Tạo nội dung marketing đa kênh: blog, social media, email, landing page.",
    longDescription: "Agent Marketing AI phân tích đối thủ, lên kế hoạch nội dung, viết bài SEO-optimized, và tạo lịch đăng content tự động.",
    category: "marketing",
    tags: ["content", "seo", "social-media", "copywriting"],
    model: "gpt-4o",
    systemPrompt: "Bạn là Content Marketing Specialist AI...",
    tools: ["web_search", "image_gen", "scheduler"],
    version: "1.5.0",
    status: "published",
    isVerified: true,
    isFeatured: true,
    iconEmoji: "📝",
    installCount: 289,
    activeInstalls: 175,
    executionCount: 3204,
    revenueSharePct: 70,
  },
  {
    name: "customer-support-ai",
    displayName: "Customer Support AI",
    description: "Xử lý ticket, phân loại ưu tiên và trả lời khách hàng 24/7.",
    longDescription: "Agent hỗ trợ khách hàng phân tích ticket, tìm kiếm knowledge base, soạn câu trả lời cá nhân hóa và leo thang nếu cần.",
    category: "support",
    tags: ["support", "tickets", "chatbot", "helpdesk"],
    model: "gpt-4o-mini",
    systemPrompt: "Bạn là Customer Support Agent chuyên nghiệp...",
    tools: ["knowledge_base", "ticket_manager"],
    version: "1.2.0",
    status: "published",
    isVerified: true,
    isFeatured: false,
    iconEmoji: "🎧",
    installCount: 198,
    activeInstalls: 134,
    executionCount: 12450,
    revenueSharePct: 70,
  },
  {
    name: "hr-recruiter-ai",
    displayName: "HR Recruiter AI",
    description: "Tuyển dụng thông minh: đăng JD, sàng lọc CV, lên lịch phỏng vấn.",
    longDescription: "Agent Recruiter AI viết JD chuẩn, đăng trên nhiều kênh, sàng lọc CV theo tiêu chí, và tự động lên lịch phỏng vấn phù hợp.",
    category: "hr",
    tags: ["recruiting", "hr", "interview", "cv-screening"],
    model: "gpt-4o-mini",
    systemPrompt: "Bạn là HR Recruiter chuyên nghiệp...",
    tools: ["job_boards", "calendar", "email_writer"],
    version: "1.1.0",
    status: "published",
    isVerified: false,
    isFeatured: false,
    iconEmoji: "👔",
    installCount: 145,
    activeInstalls: 98,
    executionCount: 2103,
    revenueSharePct: 70,
  },
  {
    name: "market-research-ai",
    displayName: "Market Research AI",
    description: "Nghiên cứu thị trường sâu: phân tích đối thủ, xu hướng, cơ hội.",
    longDescription: "Agent nghiên cứu thị trường thu thập dữ liệu từ nhiều nguồn, phân tích xu hướng và tạo báo cáo chi tiết với insights actionable.",
    category: "research",
    tags: ["research", "analytics", "competitive-intel", "market-analysis"],
    model: "gpt-4o",
    systemPrompt: "Bạn là Market Research Analyst AI...",
    tools: ["web_search", "data_analyzer", "report_writer"],
    version: "1.3.0",
    status: "published",
    isVerified: true,
    isFeatured: false,
    iconEmoji: "🔍",
    installCount: 167,
    activeInstalls: 89,
    executionCount: 1876,
    revenueSharePct: 70,
  },
  {
    name: "data-analyst-ai",
    displayName: "Data Analyst AI",
    description: "Phân tích dữ liệu, tạo biểu đồ và báo cáo insights tự động.",
    longDescription: "Agent phân tích data nhập CSV/JSON, chạy statistical analysis, tạo visualizations và xuất báo cáo PDF chuyên nghiệp.",
    category: "analytics",
    tags: ["data", "analytics", "reporting", "insights"],
    model: "gpt-4o",
    systemPrompt: "Bạn là Data Analyst AI chuyên nghiệp...",
    tools: ["data_processor", "chart_maker", "pdf_writer"],
    version: "1.0.0",
    status: "published",
    isVerified: false,
    isFeatured: false,
    iconEmoji: "📊",
    installCount: 112,
    activeInstalls: 67,
    executionCount: 934,
    revenueSharePct: 70,
  },
];

const SEED_WORKFLOWS = [
  {
    name: "ai-sdr-team",
    displayName: "AI SDR Team",
    description: "Đội sales AI hoàn chỉnh: phân tích → leads → outreach → follow-up.",
    longDescription: "Template AI SDR Team đầy đủ gồm 5 bước: phân tích thị trường, xây dựng ICP, tạo lead list, viết email outreach cá nhân hóa và follow-up tự động.",
    category: "sales",
    tags: ["sdr", "sales-team", "outreach", "complete"],
    steps: [
      { name: "Market Analysis", agentRole: "researcher", description: "Phân tích thị trường và đối thủ" },
      { name: "ICP Builder", agentRole: "strategist", description: "Xây dựng Ideal Customer Profile" },
      { name: "Lead Generation", agentRole: "sdr", description: "Tạo danh sách 50+ leads đủ điều kiện" },
      { name: "Email Outreach", agentRole: "copywriter", description: "Viết email cá nhân hóa từng lead" },
      { name: "Follow-up Sequence", agentRole: "sdr", description: "Chuỗi 3 email follow-up tự động" },
    ],
    estimatedMinutes: 15,
    version: "3.0.0",
    status: "published",
    isVerified: true,
    isFeatured: true,
    iconEmoji: "🚀",
    installCount: 421,
    activeInstalls: 267,
    executionCount: 5234,
    revenueSharePct: 70,
  },
  {
    name: "marketing-team",
    displayName: "Marketing Team",
    description: "Đội marketing AI: content strategy → creation → distribution → analytics.",
    longDescription: "Workflow Marketing Team tự động lên kế hoạch nội dung tháng, viết blog/social posts, tạo email newsletter và theo dõi performance.",
    category: "marketing",
    tags: ["marketing", "content", "social", "newsletter"],
    steps: [
      { name: "Content Strategy", agentRole: "strategist", description: "Lên kế hoạch nội dung tháng" },
      { name: "Keyword Research", agentRole: "seo-analyst", description: "Nghiên cứu từ khóa target" },
      { name: "Blog Writing", agentRole: "writer", description: "Viết 4 bài blog SEO-optimized" },
      { name: "Social Media", agentRole: "social-manager", description: "Tạo 30 posts cho Facebook/LinkedIn" },
      { name: "Email Newsletter", agentRole: "copywriter", description: "Soạn newsletter tuần" },
      { name: "Performance Report", agentRole: "analyst", description: "Báo cáo kết quả cuối tháng" },
    ],
    estimatedMinutes: 25,
    version: "2.1.0",
    status: "published",
    isVerified: true,
    isFeatured: true,
    iconEmoji: "📣",
    installCount: 356,
    activeInstalls: 198,
    executionCount: 4102,
    revenueSharePct: 70,
  },
  {
    name: "customer-support-team",
    displayName: "Customer Support Team",
    description: "Hệ thống hỗ trợ khách hàng 24/7: phân loại → xử lý → theo dõi.",
    longDescription: "Workflow Customer Support Team tự động phân loại ticket theo độ ưu tiên, tra cứu knowledge base, soạn câu trả lời và gửi follow-up satisfaction survey.",
    category: "support",
    tags: ["support", "customer-success", "helpdesk", "automation"],
    steps: [
      { name: "Ticket Triage", agentRole: "triage-agent", description: "Phân loại ticket theo priority" },
      { name: "Knowledge Search", agentRole: "researcher", description: "Tìm kiếm giải pháp trong KB" },
      { name: "Response Draft", agentRole: "support-agent", description: "Soạn câu trả lời cá nhân hóa" },
      { name: "Quality Check", agentRole: "qa-agent", description: "Kiểm tra chất lượng trước gửi" },
      { name: "Satisfaction Survey", agentRole: "feedback-agent", description: "Gửi CSAT survey sau 24h" },
    ],
    estimatedMinutes: 10,
    version: "1.5.0",
    status: "published",
    isVerified: true,
    isFeatured: false,
    iconEmoji: "🎧",
    installCount: 234,
    activeInstalls: 156,
    executionCount: 15234,
    revenueSharePct: 70,
  },
  {
    name: "recruitment-team",
    displayName: "Recruitment Team",
    description: "Quy trình tuyển dụng AI: JD → sourcing → screening → scheduling.",
    longDescription: "Workflow Recruitment Team tự động tạo JD chuẩn, đăng trên job boards, sàng lọc CV theo tiêu chí, gửi email invite và lên lịch phỏng vấn.",
    category: "hr",
    tags: ["recruiting", "talent-acquisition", "hr", "interview"],
    steps: [
      { name: "Job Description", agentRole: "hr-writer", description: "Viết JD hấp dẫn, chuẩn" },
      { name: "Job Posting", agentRole: "distribution-agent", description: "Đăng trên LinkedIn, VietnamWorks, TopCV" },
      { name: "CV Screening", agentRole: "recruiter", description: "Sàng lọc CV theo tiêu chí" },
      { name: "Shortlist Email", agentRole: "hr-coordinator", description: "Gửi email mời phỏng vấn" },
      { name: "Interview Schedule", agentRole: "scheduler", description: "Tự động lên lịch phỏng vấn" },
    ],
    estimatedMinutes: 20,
    version: "1.2.0",
    status: "published",
    isVerified: false,
    isFeatured: false,
    iconEmoji: "👥",
    installCount: 189,
    activeInstalls: 112,
    executionCount: 2341,
    revenueSharePct: 70,
  },
  {
    name: "cold-email-campaign",
    displayName: "Cold Email Campaign",
    description: "Campaign email lạnh 3 bước: research → personalize → send → track.",
    longDescription: "Workflow Cold Email chuyên biệt nghiên cứu từng prospect, viết email cá nhân hóa cao, lên lịch gửi tối ưu và theo dõi tỷ lệ mở/click.",
    category: "sales",
    tags: ["cold-email", "outreach", "sequence", "personalization"],
    steps: [
      { name: "Prospect Research", agentRole: "researcher", description: "Nghiên cứu sâu từng prospect" },
      { name: "Email Personalization", agentRole: "copywriter", description: "Viết email cá nhân hóa 100%" },
      { name: "A/B Subject Lines", agentRole: "optimizer", description: "Tạo 3 subject line variations" },
      { name: "Send Scheduling", agentRole: "scheduler", description: "Lên lịch gửi tối ưu theo timezone" },
    ],
    estimatedMinutes: 12,
    version: "2.0.0",
    status: "published",
    isVerified: true,
    isFeatured: false,
    iconEmoji: "✉️",
    installCount: 298,
    activeInstalls: 189,
    executionCount: 6782,
    revenueSharePct: 70,
  },
  {
    name: "market-research-report",
    displayName: "Market Research Report",
    description: "Báo cáo nghiên cứu thị trường toàn diện trong 30 phút.",
    longDescription: "Workflow tự động thu thập data từ web, phân tích đối thủ, xu hướng ngành và tạo báo cáo chuyên nghiệp 20+ trang với charts và insights.",
    category: "research",
    tags: ["research", "report", "market-analysis", "competitive"],
    steps: [
      { name: "Data Collection", agentRole: "researcher", description: "Thu thập data từ 20+ nguồn" },
      { name: "Competitor Analysis", agentRole: "analyst", description: "Phân tích top 10 đối thủ" },
      { name: "Trend Analysis", agentRole: "analyst", description: "Xác định xu hướng thị trường" },
      { name: "Report Writing", agentRole: "writer", description: "Viết báo cáo 20+ trang" },
      { name: "Executive Summary", agentRole: "strategist", description: "Tóm tắt insights quan trọng" },
    ],
    estimatedMinutes: 30,
    version: "1.4.0",
    status: "published",
    isVerified: true,
    isFeatured: false,
    iconEmoji: "📊",
    installCount: 176,
    activeInstalls: 98,
    executionCount: 1923,
    revenueSharePct: 70,
  },
];

const SEED_REVIEWS = [
  { targetType: "agent", rating: 5, comment: "Agent SDR cực kỳ hiệu quả, tăng 3x leads trong 2 tuần!" },
  { targetType: "agent", rating: 4, comment: "Chất lượng email outreach rất tốt, cá nhân hóa cao." },
  { targetType: "workflow", rating: 5, comment: "Workflow Marketing Team tiết kiệm 40 giờ/tháng cho team tôi." },
  { targetType: "workflow", rating: 5, comment: "Import 1 click, chạy ngay không cần setup phức tạp." },
];

// Seed function
async function seedMarketplace() {
  const existingAgents = await db.select({ id: marketplaceAgentsTable.id }).from(marketplaceAgentsTable).limit(1);
  if (existingAgents.length > 0) return;

  // Get a system org/user for seeded content
  const [firstOrg] = await db.select().from(organizationsTable).limit(1);
  const [firstUser] = await db.select().from(usersTable).limit(1);
  if (!firstOrg || !firstUser) return;

  const agentRows = SEED_AGENTS.map((a) => ({
    ...a,
    organizationId: firstOrg.id,
    creatorId: firstUser.id,
    successRate: "98.50",
    avgTokenCost: 450,
  }));

  const insertedAgents = await db.insert(marketplaceAgentsTable).values(agentRows).returning();

  const workflowRows = SEED_WORKFLOWS.map((w) => ({
    ...w,
    organizationId: firstOrg.id,
    creatorId: firstUser.id,
    successRate: "97.20",
    avgTokenCost: 1200,
  }));

  const insertedWorkflows = await db.insert(marketplaceWorkflowsTable).values(workflowRows).returning();

  // Seed some reviews
  for (let i = 0; i < SEED_REVIEWS.length; i++) {
    const r = SEED_REVIEWS[i];
    const targetId = r.targetType === "agent"
      ? insertedAgents[i % insertedAgents.length]?.id
      : insertedWorkflows[i % insertedWorkflows.length]?.id;
    if (!targetId) continue;
    await db.insert(reviewsTable).values({
      organizationId: firstOrg.id,
      createdBy: firstUser.id,
      targetType: r.targetType,
      targetId,
      rating: r.rating,
      comment: r.comment,
    });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function withRatings<T extends { id: number }>(items: T[], targetType: string) {
  const ids = items.map((i) => i.id);
  if (ids.length === 0) return items.map((i) => ({ ...i, avgRating: 0, reviewCount: 0 }));

  const reviewStats = await db
    .select({
      targetId: reviewsTable.targetId,
      avg: avg(reviewsTable.rating),
      cnt: count(reviewsTable.id),
    })
    .from(reviewsTable)
    .where(and(eq(reviewsTable.targetType, targetType), sql`${reviewsTable.targetId} = ANY(${sql.raw(`ARRAY[${ids.join(",")}]`)})`))
    .groupBy(reviewsTable.targetId);

  const statsMap = Object.fromEntries(reviewStats.map((r) => [r.targetId, r]));

  return items.map((item) => ({
    ...item,
    avgRating: Math.round(Number(statsMap[item.id]?.avg ?? 0) * 10) / 10,
    reviewCount: Number(statsMap[item.id]?.cnt ?? 0),
  }));
}

// ── GET /marketplace/agents ───────────────────────────────────────────────────
router.get("/marketplace/agents", async (req, res): Promise<void> => {
  try {
    await seedMarketplace();

    const { category, search, sort, status, featured } = req.query as Record<string, string>;

    let query = db.select().from(marketplaceAgentsTable);
    const conditions = [eq(marketplaceAgentsTable.status, status || "published")];

    if (category && category !== "all") conditions.push(eq(marketplaceAgentsTable.category, category));
    if (featured === "true") conditions.push(eq(marketplaceAgentsTable.isFeatured, true));
    if (search) {
      conditions.push(
        or(
          ilike(marketplaceAgentsTable.displayName, `%${search}%`),
          ilike(marketplaceAgentsTable.description, `%${search}%`),
        )!,
      );
    }

    const items = await db
      .select()
      .from(marketplaceAgentsTable)
      .where(and(...conditions))
      .orderBy(
        sort === "rating" ? desc(marketplaceAgentsTable.installCount) :
        sort === "newest" ? desc(marketplaceAgentsTable.createdAt) :
        sort === "name" ? asc(marketplaceAgentsTable.displayName) :
        desc(marketplaceAgentsTable.installCount)
      );

    const withRated = await withRatings(items, "agent");
    res.json(withRated);
  } catch (err) {
    console.error("[marketplace/agents]", err);
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

// ── GET /marketplace/agents/:id ────────────────────────────────────────────────
router.get("/marketplace/agents/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [agent] = await db.select().from(marketplaceAgentsTable).where(eq(marketplaceAgentsTable.id, id));
    if (!agent) { res.status(404).json({ error: "Not found" }); return; }

    const reviews = await db.select({
      id: reviewsTable.id,
      rating: reviewsTable.rating,
      comment: reviewsTable.comment,
      createdAt: reviewsTable.createdAt,
      authorEmail: usersTable.email,
      authorName: usersTable.name,
    })
      .from(reviewsTable)
      .leftJoin(usersTable, eq(reviewsTable.createdBy, usersTable.id))
      .where(and(eq(reviewsTable.targetType, "agent"), eq(reviewsTable.targetId, id)))
      .orderBy(desc(reviewsTable.createdAt));

    const avgRating = reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

    res.json({ ...agent, avgRating, reviewCount: reviews.length, reviews });
  } catch (err) {
    console.error("[marketplace/agents/:id]", err);
    res.status(500).json({ error: "Failed to fetch agent" });
  }
});

// ── POST /marketplace/agents/:id/install ─────────────────────────────────────
router.post("/marketplace/agents/:id/install", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const orgId = req.user.organizationId;

    const [agent] = await db.select().from(marketplaceAgentsTable).where(eq(marketplaceAgentsTable.id, id));
    if (!agent) { res.status(404).json({ error: "Not found" }); return; }

    const agentName = (req.body.name as string) || agent.displayName;

    const [newAgent] = await db.insert(agentsTable).values({
      organizationId: orgId,
      name: agentName,
      role: agent.name,
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      tools: agent.tools as string[],
      status: "idle",
    }).returning();

    await db.update(marketplaceAgentsTable)
      .set({
        installCount: agent.installCount + 1,
        activeInstalls: agent.activeInstalls + 1,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceAgentsTable.id, id));

    res.json({ success: true, agent: newAgent, message: `Agent "${agentName}" đã được cài đặt!` });
  } catch (err) {
    console.error("[marketplace/agents/install]", err);
    res.status(500).json({ error: "Failed to install agent" });
  }
});

// ── POST /marketplace/agents (publish) ────────────────────────────────────────
router.post("/marketplace/agents", async (req, res): Promise<void> => {
  try {
    const body = { ...req.body, organizationId: req.user.organizationId, creatorId: req.user.id };
    const [item] = await db.insert(marketplaceAgentsTable).values({
      ...body,
      status: "draft",
      successRate: "100.00",
    }).returning();
    res.status(201).json(item);
  } catch (err) {
    console.error("[marketplace/agents POST]", err);
    res.status(500).json({ error: "Failed to publish agent" });
  }
});

// ── PATCH /marketplace/agents/:id ─────────────────────────────────────────────
router.patch("/marketplace/agents/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.update(marketplaceAgentsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(marketplaceAgentsTable.id, id), eq(marketplaceAgentsTable.organizationId, req.user.organizationId)))
      .returning();
    if (!item) { res.status(404).json({ error: "Not found" }); return; }
    res.json(item);
  } catch (err) {
    console.error("[marketplace/agents PATCH]", err);
    res.status(500).json({ error: "Failed to update agent" });
  }
});

// ── GET /marketplace/workflows ─────────────────────────────────────────────────
router.get("/marketplace/workflows", async (req, res): Promise<void> => {
  try {
    await seedMarketplace();

    const { category, search, sort, featured } = req.query as Record<string, string>;

    const conditions = [eq(marketplaceWorkflowsTable.status, "published")];
    if (category && category !== "all") conditions.push(eq(marketplaceWorkflowsTable.category, category));
    if (featured === "true") conditions.push(eq(marketplaceWorkflowsTable.isFeatured, true));
    if (search) {
      conditions.push(
        or(
          ilike(marketplaceWorkflowsTable.displayName, `%${search}%`),
          ilike(marketplaceWorkflowsTable.description, `%${search}%`),
        )!,
      );
    }

    const items = await db
      .select()
      .from(marketplaceWorkflowsTable)
      .where(and(...conditions))
      .orderBy(
        sort === "newest" ? desc(marketplaceWorkflowsTable.createdAt) :
        sort === "name" ? asc(marketplaceWorkflowsTable.displayName) :
        desc(marketplaceWorkflowsTable.installCount)
      );

    const withRated = await withRatings(items, "workflow");
    res.json(withRated);
  } catch (err) {
    console.error("[marketplace/workflows]", err);
    res.status(500).json({ error: "Failed to fetch workflows" });
  }
});

// ── GET /marketplace/workflows/:id ─────────────────────────────────────────────
router.get("/marketplace/workflows/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [workflow] = await db.select().from(marketplaceWorkflowsTable).where(eq(marketplaceWorkflowsTable.id, id));
    if (!workflow) { res.status(404).json({ error: "Not found" }); return; }

    const reviews = await db.select({
      id: reviewsTable.id,
      rating: reviewsTable.rating,
      comment: reviewsTable.comment,
      createdAt: reviewsTable.createdAt,
      authorEmail: usersTable.email,
      authorName: usersTable.name,
    })
      .from(reviewsTable)
      .leftJoin(usersTable, eq(reviewsTable.createdBy, usersTable.id))
      .where(and(eq(reviewsTable.targetType, "workflow"), eq(reviewsTable.targetId, id)))
      .orderBy(desc(reviewsTable.createdAt));

    const avgRating = reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

    res.json({ ...workflow, avgRating, reviewCount: reviews.length, reviews });
  } catch (err) {
    console.error("[marketplace/workflows/:id]", err);
    res.status(500).json({ error: "Failed to fetch workflow" });
  }
});

// ── POST /marketplace/workflows/:id/install ────────────────────────────────────
router.post("/marketplace/workflows/:id/install", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const orgId = req.user.organizationId;

    const [wf] = await db.select().from(marketplaceWorkflowsTable).where(eq(marketplaceWorkflowsTable.id, id));
    if (!wf) { res.status(404).json({ error: "Not found" }); return; }

    const wfName = (req.body.name as string) || wf.displayName;
    const steps = (wf.steps as { name: string; agentRole: string; description?: string }[]) || [];

    const [newWf] = await db.insert(workflowsTable).values({
      organizationId: orgId,
      name: wfName,
      description: wf.description,
      status: "idle",
    }).returning();

    if (steps.length > 0) {
      await db.insert(workflowStepsTable).values(
        steps.map((s, i) => ({
          workflowId: newWf.id,
          name: s.name,
          agentRole: s.agentRole,
          prompt: s.description ?? "",
          order: i + 1,
          outputFormat: "text",
        }))
      );
    }

    await db.update(marketplaceWorkflowsTable)
      .set({
        installCount: wf.installCount + 1,
        activeInstalls: wf.activeInstalls + 1,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceWorkflowsTable.id, id));

    res.json({ success: true, workflow: newWf, message: `Workflow "${wfName}" đã được cài đặt!` });
  } catch (err) {
    console.error("[marketplace/workflows/install]", err);
    res.status(500).json({ error: "Failed to install workflow" });
  }
});

// ── POST /marketplace/workflows (publish) ─────────────────────────────────────
router.post("/marketplace/workflows", async (req, res): Promise<void> => {
  try {
    const body = { ...req.body, organizationId: req.user.organizationId, creatorId: req.user.id };
    const [item] = await db.insert(marketplaceWorkflowsTable).values({
      ...body,
      status: "draft",
      successRate: "100.00",
    }).returning();
    res.status(201).json(item);
  } catch (err) {
    console.error("[marketplace/workflows POST]", err);
    res.status(500).json({ error: "Failed to publish workflow" });
  }
});

// ── GET /marketplace/reviews/:type/:id ────────────────────────────────────────
router.get("/marketplace/reviews/:type/:id", async (req, res): Promise<void> => {
  try {
    const { type, id } = req.params;
    const reviews = await db
      .select({
        id: reviewsTable.id,
        rating: reviewsTable.rating,
        comment: reviewsTable.comment,
        createdAt: reviewsTable.createdAt,
        authorEmail: usersTable.email,
        authorName: usersTable.name,
      })
      .from(reviewsTable)
      .leftJoin(usersTable, eq(reviewsTable.createdBy, usersTable.id))
      .where(and(eq(reviewsTable.targetType, type), eq(reviewsTable.targetId, parseInt(id))))
      .orderBy(desc(reviewsTable.createdAt));

    res.json(reviews);
  } catch (err) {
    console.error("[marketplace/reviews GET]", err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// ── POST /marketplace/reviews ─────────────────────────────────────────────────
const ReviewBody = z.object({
  targetType: z.enum(["agent", "workflow"]),
  targetId: z.number().int(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().default(""),
});

router.post("/marketplace/reviews", async (req, res): Promise<void> => {
  const parsed = ReviewBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const [review] = await db.insert(reviewsTable).values({
      ...parsed.data,
      organizationId: req.user.organizationId,
      createdBy: req.user.id,
    }).returning();
    res.status(201).json(review);
  } catch (err) {
    console.error("[marketplace/reviews POST]", err);
    res.status(500).json({ error: "Failed to submit review" });
  }
});

// ── GET /marketplace/creator-profile ──────────────────────────────────────────
router.get("/marketplace/creator-profile", async (req, res): Promise<void> => {
  try {
    const userId = req.user.id;
    const orgId = req.user.organizationId;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId));

    const myAgents = await db.select().from(marketplaceAgentsTable)
      .where(eq(marketplaceAgentsTable.creatorId, userId))
      .orderBy(desc(marketplaceAgentsTable.installCount));

    const myWorkflows = await db.select().from(marketplaceWorkflowsTable)
      .where(eq(marketplaceWorkflowsTable.creatorId, userId))
      .orderBy(desc(marketplaceWorkflowsTable.installCount));

    const totalInstalls = [...myAgents, ...myWorkflows].reduce(
      (sum, item) => sum + item.installCount, 0
    );
    const totalExecutions = [...myAgents, ...myWorkflows].reduce(
      (sum, item) => sum + item.executionCount, 0
    );

    const payouts = await db.select().from(creatorPayoutsTable)
      .where(eq(creatorPayoutsTable.creatorId, userId))
      .orderBy(desc(creatorPayoutsTable.createdAt));

    const totalEarnings = payouts.reduce((s, p) => s + p.payoutCents, 0);

    res.json({
      user: { id: user?.id, name: user?.name, email: user?.email, createdAt: user?.createdAt },
      org: { id: org?.id, name: org?.name },
      stats: {
        totalInstalls,
        totalExecutions,
        publishedAgents: myAgents.filter(a => a.status === "published").length,
        publishedWorkflows: myWorkflows.filter(w => w.status === "published").length,
        totalEarningsCents: totalEarnings,
        totalEarnings: (totalEarnings / 100).toFixed(2),
      },
      agents: myAgents,
      workflows: myWorkflows,
      payouts,
    });
  } catch (err) {
    console.error("[marketplace/creator-profile]", err);
    res.status(500).json({ error: "Failed to fetch creator profile" });
  }
});

// ── GET /marketplace/analytics ────────────────────────────────────────────────
router.get("/marketplace/analytics", async (req, res): Promise<void> => {
  try {
    const [agentStats] = await db.select({
      totalInstalls: sql<number>`SUM(${marketplaceAgentsTable.installCount})`,
      totalExecutions: sql<number>`SUM(${marketplaceAgentsTable.executionCount})`,
      totalPublished: count(marketplaceAgentsTable.id),
    }).from(marketplaceAgentsTable).where(eq(marketplaceAgentsTable.status, "published"));

    const [workflowStats] = await db.select({
      totalInstalls: sql<number>`SUM(${marketplaceWorkflowsTable.installCount})`,
      totalExecutions: sql<number>`SUM(${marketplaceWorkflowsTable.executionCount})`,
      totalPublished: count(marketplaceWorkflowsTable.id),
    }).from(marketplaceWorkflowsTable).where(eq(marketplaceWorkflowsTable.status, "published"));

    const [reviewStats] = await db.select({
      count: count(reviewsTable.id),
      avgRating: avg(reviewsTable.rating),
    }).from(reviewsTable);

    const topAgents = await db.select()
      .from(marketplaceAgentsTable)
      .where(eq(marketplaceAgentsTable.status, "published"))
      .orderBy(desc(marketplaceAgentsTable.installCount))
      .limit(5);

    const topWorkflows = await db.select()
      .from(marketplaceWorkflowsTable)
      .where(eq(marketplaceWorkflowsTable.status, "published"))
      .orderBy(desc(marketplaceWorkflowsTable.installCount))
      .limit(5);

    res.json({
      agents: agentStats,
      workflows: workflowStats,
      reviews: { ...reviewStats, avgRating: Math.round(Number(reviewStats?.avgRating ?? 0) * 10) / 10 },
      topAgents,
      topWorkflows,
    });
  } catch (err) {
    console.error("[marketplace/analytics]", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ── PATCH /marketplace/agents/:id/status (verification) ───────────────────────
router.patch("/marketplace/agents/:id/status", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body as { status: string };
    const [item] = await db.update(marketplaceAgentsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(marketplaceAgentsTable.id, id))
      .returning();
    if (!item) { res.status(404).json({ error: "Not found" }); return; }
    res.json(item);
  } catch (err) {
    console.error("[marketplace/agents status]", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

export default router;
