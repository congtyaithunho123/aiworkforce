import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import {
  db,
  marketingProjectsTable,
  marketingResearchTable,
  marketingKeywordsTable,
  marketingContentTable,
} from "@workspace/db";
import {
  runMarketResearchAgent,
  runKeywordAnalysisAgent,
  runContentAgent,
  runSeoOptimizationAgent,
  runReviewerAgent,
  type KeywordAnalysisOutput,
  type MarketResearchOutput,
} from "../lib/marketing-agents";
import { z } from "zod/v4";
import { logger } from "../lib/logger";

const router = Router();

// ── POST /api/marketing/project ─────────────────────────────────────────────
const CreateProjectSchema = z.object({
  topic: z.string().min(1),
  targetAudience: z.string().min(1),
  niche: z.string().min(1),
});

router.post("/marketing/project", async (req, res) => {
  const parsed = CreateProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const [project] = await db.insert(marketingProjectsTable).values({
    topic: parsed.data.topic,
    targetAudience: parsed.data.targetAudience,
    niche: parsed.data.niche,
    workflowStep: "research",
    status: "draft",
  }).returning();

  return res.status(201).json({ project });
});

// ── POST /api/marketing/research ────────────────────────────────────────────
router.post("/marketing/research", async (req, res) => {
  const parsed = z.object({ projectId: z.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const [project] = await db.select().from(marketingProjectsTable).where(eq(marketingProjectsTable.id, parsed.data.projectId));
  if (!project) return res.status(404).json({ error: "Project not found" });

  await db.update(marketingProjectsTable).set({ status: "running" }).where(eq(marketingProjectsTable.id, project.id));

  try {
    const { output, tokens, cost } = await runMarketResearchAgent(
      project.topic, project.targetAudience ?? "", project.niche ?? "",
    );

    const existing = await db.select().from(marketingResearchTable).where(eq(marketingResearchTable.projectId, project.id));
    let research;
    if (existing.length > 0) {
      [research] = await db.update(marketingResearchTable).set({
        marketTrends: output.marketTrends,
        targetPersonas: output.targetPersonas,
        competitorAngles: output.competitorAngles,
        contentAngles: output.contentAngles,
        summary: output.summary,
      }).where(eq(marketingResearchTable.projectId, project.id)).returning();
    } else {
      [research] = await db.insert(marketingResearchTable).values({
        projectId: project.id,
        marketTrends: output.marketTrends,
        targetPersonas: output.targetPersonas,
        competitorAngles: output.competitorAngles,
        contentAngles: output.contentAngles,
        summary: output.summary,
      }).returning();
    }

    await db.update(marketingProjectsTable).set({
      workflowStep: "keywords",
      status: "draft",
      totalTokens: sql`${marketingProjectsTable.totalTokens} + ${tokens}`,
      estimatedCost: sql`${marketingProjectsTable.estimatedCost} + ${cost}`,
    }).where(eq(marketingProjectsTable.id, project.id));

    return res.json({ research, tokens, cost });
  } catch (err) {
    await db.update(marketingProjectsTable).set({ status: "failed" }).where(eq(marketingProjectsTable.id, project.id));
    logger.error({ err }, "Market research agent failed");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Research failed" });
  }
});

// ── POST /api/marketing/keywords ─────────────────────────────────────────────
router.post("/marketing/keywords", async (req, res) => {
  const parsed = z.object({ projectId: z.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const [project] = await db.select().from(marketingProjectsTable).where(eq(marketingProjectsTable.id, parsed.data.projectId));
  if (!project) return res.status(404).json({ error: "Project not found" });

  const [research] = await db.select().from(marketingResearchTable).where(eq(marketingResearchTable.projectId, project.id));
  if (!research) return res.status(400).json({ error: "Research not completed yet" });

  await db.update(marketingProjectsTable).set({ status: "running" }).where(eq(marketingProjectsTable.id, project.id));

  try {
    const { output, tokens, cost } = await runKeywordAnalysisAgent(
      project.topic,
      (research.contentAngles as string[]) ?? [],
      project.targetAudience ?? "",
    );

    const existing = await db.select().from(marketingKeywordsTable).where(eq(marketingKeywordsTable.projectId, project.id));
    let keywords;
    if (existing.length > 0) {
      [keywords] = await db.update(marketingKeywordsTable).set({
        primaryKeyword: output.primaryKeyword,
        secondaryKeywords: output.secondaryKeywords,
        lsiKeywords: output.lsiKeywords,
        suggestedTitle: output.suggestedTitle,
        metaDescription: output.metaDescription,
        keywordData: output.keywordData,
      }).where(eq(marketingKeywordsTable.projectId, project.id)).returning();
    } else {
      [keywords] = await db.insert(marketingKeywordsTable).values({
        projectId: project.id,
        primaryKeyword: output.primaryKeyword,
        secondaryKeywords: output.secondaryKeywords,
        lsiKeywords: output.lsiKeywords,
        suggestedTitle: output.suggestedTitle,
        metaDescription: output.metaDescription,
        keywordData: output.keywordData,
      }).returning();
    }

    await db.update(marketingProjectsTable).set({
      workflowStep: "content",
      status: "draft",
      totalTokens: sql`${marketingProjectsTable.totalTokens} + ${tokens}`,
      estimatedCost: sql`${marketingProjectsTable.estimatedCost} + ${cost}`,
    }).where(eq(marketingProjectsTable.id, project.id));

    return res.json({ keywords, tokens, cost });
  } catch (err) {
    await db.update(marketingProjectsTable).set({ status: "failed" }).where(eq(marketingProjectsTable.id, project.id));
    return res.status(500).json({ error: err instanceof Error ? err.message : "Keyword analysis failed" });
  }
});

// ── POST /api/marketing/content ─────────────────────────────────────────────
router.post("/marketing/content", async (req, res) => {
  const parsed = z.object({ projectId: z.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const [project] = await db.select().from(marketingProjectsTable).where(eq(marketingProjectsTable.id, parsed.data.projectId));
  if (!project) return res.status(404).json({ error: "Project not found" });

  const [[research], [keywords]] = await Promise.all([
    db.select().from(marketingResearchTable).where(eq(marketingResearchTable.projectId, project.id)),
    db.select().from(marketingKeywordsTable).where(eq(marketingKeywordsTable.projectId, project.id)),
  ]);
  if (!research || !keywords) return res.status(400).json({ error: "Research and keywords must be completed first" });

  await db.update(marketingProjectsTable).set({ status: "running" }).where(eq(marketingProjectsTable.id, project.id));

  try {
    const { output, tokens, cost } = await runContentAgent(
      project.topic,
      keywords as unknown as KeywordAnalysisOutput,
      research as unknown as MarketResearchOutput,
      project.targetAudience ?? "",
    );

    let totalTokens = tokens;
    let totalCost = cost;

    // Chain: SEO optimization right after content
    const seoResult = await runSeoOptimizationAgent(
      output.body,
      keywords.primaryKeyword ?? "",
      (keywords.secondaryKeywords as string[]) ?? [],
      output.metaDescription,
    );
    totalTokens += seoResult.tokens;
    totalCost += seoResult.cost;

    const existing = await db.select().from(marketingContentTable).where(eq(marketingContentTable.projectId, project.id));
    let content;
    if (existing.length > 0) {
      [content] = await db.update(marketingContentTable).set({
        title: output.title,
        slug: output.slug,
        metaDescription: seoResult.output.improvedMetaDescription,
        outline: output.outline,
        body: seoResult.output.improvedBody,
        wordCount: output.wordCount,
        seoScore: seoResult.output.seoScore,
        seoSuggestions: seoResult.output.suggestions,
        reviewStatus: "pending",
      }).where(eq(marketingContentTable.projectId, project.id)).returning();
    } else {
      [content] = await db.insert(marketingContentTable).values({
        projectId: project.id,
        title: output.title,
        slug: output.slug,
        metaDescription: seoResult.output.improvedMetaDescription,
        outline: output.outline,
        body: seoResult.output.improvedBody,
        wordCount: output.wordCount,
        seoScore: seoResult.output.seoScore,
        seoSuggestions: seoResult.output.suggestions,
        reviewStatus: "pending",
      }).returning();
    }

    await db.update(marketingProjectsTable).set({
      workflowStep: "review",
      status: "draft",
      totalTokens: sql`${marketingProjectsTable.totalTokens} + ${totalTokens}`,
      estimatedCost: sql`${marketingProjectsTable.estimatedCost} + ${totalCost}`,
    }).where(eq(marketingProjectsTable.id, project.id));

    return res.json({ content, tokens: totalTokens, cost: totalCost });
  } catch (err) {
    await db.update(marketingProjectsTable).set({ status: "failed" }).where(eq(marketingProjectsTable.id, project.id));
    logger.error({ err }, "Content agent failed");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Content generation failed" });
  }
});

// ── POST /api/marketing/review ──────────────────────────────────────────────
router.post("/marketing/review", async (req, res) => {
  const parsed = z.object({ projectId: z.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const [project] = await db.select().from(marketingProjectsTable).where(eq(marketingProjectsTable.id, parsed.data.projectId));
  if (!project) return res.status(404).json({ error: "Project not found" });

  const [[content], [keywords]] = await Promise.all([
    db.select().from(marketingContentTable).where(eq(marketingContentTable.projectId, project.id)),
    db.select().from(marketingKeywordsTable).where(eq(marketingKeywordsTable.projectId, project.id)),
  ]);
  if (!content) return res.status(400).json({ error: "Content not generated yet" });

  await db.update(marketingProjectsTable).set({ status: "running" }).where(eq(marketingProjectsTable.id, project.id));

  try {
    const { output, tokens, cost } = await runReviewerAgent(
      content.title ?? project.topic,
      content.body ?? "",
      project.targetAudience ?? "",
      keywords?.primaryKeyword ?? project.topic,
    );

    const [updated] = await db.update(marketingContentTable).set({
      reviewScore: output.score,
      reviewFeedback: output.feedback,
      reviewStatus: output.approved ? "approved" : "needs_revision",
    }).where(eq(marketingContentTable.projectId, project.id)).returning();

    const nextStep = output.approved ? "published" : "content";
    await db.update(marketingProjectsTable).set({
      workflowStep: nextStep,
      status: output.approved ? "published" : "draft",
      totalTokens: sql`${marketingProjectsTable.totalTokens} + ${tokens}`,
      estimatedCost: sql`${marketingProjectsTable.estimatedCost} + ${cost}`,
    }).where(eq(marketingProjectsTable.id, project.id));

    return res.json({ review: output, content: updated, tokens, cost });
  } catch (err) {
    await db.update(marketingProjectsTable).set({ status: "failed" }).where(eq(marketingProjectsTable.id, project.id));
    return res.status(500).json({ error: err instanceof Error ? err.message : "Review failed" });
  }
});

// ── POST /api/marketing/publish ─────────────────────────────────────────────
router.post("/marketing/publish", async (req, res) => {
  const parsed = z.object({ projectId: z.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const [project] = await db.update(marketingProjectsTable).set({
    status: "published",
    workflowStep: "published",
  }).where(eq(marketingProjectsTable.id, parsed.data.projectId)).returning();

  return res.json({ project });
});

// ── GET /api/marketing/projects ──────────────────────────────────────────────
router.get("/marketing/projects", async (_req, res) => {
  const projects = await db.select().from(marketingProjectsTable).orderBy(desc(marketingProjectsTable.createdAt));
  return res.json({ projects });
});

// ── GET /api/marketing/project/:id ──────────────────────────────────────────
router.get("/marketing/project/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [[project], [research], [keywords], [content]] = await Promise.all([
    db.select().from(marketingProjectsTable).where(eq(marketingProjectsTable.id, id)),
    db.select().from(marketingResearchTable).where(eq(marketingResearchTable.projectId, id)),
    db.select().from(marketingKeywordsTable).where(eq(marketingKeywordsTable.projectId, id)),
    db.select().from(marketingContentTable).where(eq(marketingContentTable.projectId, id)),
  ]);

  if (!project) return res.status(404).json({ error: "Project not found" });
  return res.json({ project, research, keywords, content });
});

// ── GET /api/marketing/dashboard ─────────────────────────────────────────────
router.get("/marketing/dashboard", async (_req, res) => {
  const [projectsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(marketingProjectsTable);
  const [publishedCount] = await db.select({ count: sql<number>`count(*)::int` }).from(marketingProjectsTable)
    .where(eq(marketingProjectsTable.status, "published"));
  const [contentCount] = await db.select({ count: sql<number>`count(*)::int` }).from(marketingContentTable);
  const [costAgg] = await db.select({ total: sql<number>`coalesce(sum(estimated_cost),0)` }).from(marketingProjectsTable);
  const [tokensAgg] = await db.select({ total: sql<number>`coalesce(sum(total_tokens),0)` }).from(marketingProjectsTable);

  const recentProjects = await db.select().from(marketingProjectsTable)
    .orderBy(desc(marketingProjectsTable.createdAt)).limit(5);

  return res.json({
    stats: {
      projects: projectsCount.count,
      published: publishedCount.count,
      articles: contentCount.count,
      totalCost: costAgg.total,
      totalTokens: tokensAgg.total,
    },
    recentProjects,
  });
});

// ── GET /api/marketing/project/:id/export/md ────────────────────────────────
router.get("/marketing/project/:id/export/md", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [[project], [keywords], [content]] = await Promise.all([
    db.select().from(marketingProjectsTable).where(eq(marketingProjectsTable.id, id)),
    db.select().from(marketingKeywordsTable).where(eq(marketingKeywordsTable.projectId, id)),
    db.select().from(marketingContentTable).where(eq(marketingContentTable.projectId, id)),
  ]);

  if (!content) return res.status(404).json({ error: "Content not found" });

  const md = `---
title: "${content.title}"
slug: "${content.slug}"
description: "${content.metaDescription}"
primaryKeyword: "${keywords?.primaryKeyword ?? ""}"
seoScore: ${content.seoScore ?? 0}
reviewScore: ${content.reviewScore ?? 0}
---

# ${content.title}

${content.body}
`;

  res.setHeader("Content-Type", "text/markdown");
  res.setHeader("Content-Disposition", `attachment; filename="${content.slug ?? `article-${id}`}.md"`);
  return res.send(md);
});

// ── GET /api/marketing/project/:id/export/html ──────────────────────────────
router.get("/marketing/project/:id/export/html", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [[content], [keywords]] = await Promise.all([
    db.select().from(marketingContentTable).where(eq(marketingContentTable.projectId, id)),
    db.select().from(marketingKeywordsTable).where(eq(marketingKeywordsTable.projectId, id)),
  ]);
  if (!content) return res.status(404).json({ error: "Content not found" });

  // Simple markdown-to-html
  const bodyHtml = (content.body ?? "")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^- (.+)$/gm, "<li>$1</li>");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="description" content="${content.metaDescription ?? ""}">
<title>${content.title ?? ""}</title>
<style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;line-height:1.7;color:#222}h1,h2,h3{line-height:1.3}</style>
</head>
<body>
<h1>${content.title ?? ""}</h1>
<p>${bodyHtml}</p>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  res.setHeader("Content-Disposition", `attachment; filename="${content.slug ?? `article-${id}`}.html"`);
  return res.send(html);
});

export default router;
