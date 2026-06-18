import { z } from "zod/v4";
import OpenAI from "openai";
import { logger } from "./logger";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = "gpt-4o-mini";

const MODEL_COSTS: Record<string, { prompt: number; completion: number }> = {
  "gpt-4o":      { prompt: 0.0025,  completion: 0.01 },
  "gpt-4o-mini": { prompt: 0.00015, completion: 0.0006 },
};

export function calcCost(model: string, p: number, c: number) {
  const r = MODEL_COSTS[model] ?? { prompt: 0.001, completion: 0.002 };
  return (p / 1000) * r.prompt + (c / 1000) * r.completion;
}

async function callJson<T extends z.ZodTypeAny>(
  schema: T,
  system: string,
  user: string,
): Promise<{ data: z.infer<T>; promptTokens: number; completionTokens: number; totalTokens: number }> {
  const res = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system + "\n\nRespond ONLY with valid JSON. No markdown fences." },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    max_tokens: 4096,
  });
  const raw = res.choices[0]?.message?.content ?? "{}";
  const data = schema.parse(JSON.parse(raw));
  return {
    data,
    promptTokens: res.usage?.prompt_tokens ?? 0,
    completionTokens: res.usage?.completion_tokens ?? 0,
    totalTokens: res.usage?.total_tokens ?? 0,
  };
}

// ── Schemas ────────────────────────────────────────────────────────────────

export const MarketResearchOutputSchema = z.object({
  marketTrends: z.array(z.string()),
  targetPersonas: z.array(z.string()),
  competitorAngles: z.array(z.string()),
  contentAngles: z.array(z.string()),
  summary: z.string(),
});
export type MarketResearchOutput = z.infer<typeof MarketResearchOutputSchema>;

export const KeywordItemSchema = z.object({
  keyword: z.string(),
  intent: z.enum(["informational", "commercial", "transactional", "navigational"]),
  difficulty: z.enum(["low", "medium", "high"]),
  volume: z.enum(["low", "medium", "high"]),
});

export const KeywordAnalysisOutputSchema = z.object({
  primaryKeyword: z.string(),
  secondaryKeywords: z.array(z.string()),
  lsiKeywords: z.array(z.string()),
  suggestedTitle: z.string(),
  metaDescription: z.string(),
  keywordData: z.array(KeywordItemSchema),
});
export type KeywordAnalysisOutput = z.infer<typeof KeywordAnalysisOutputSchema>;

export const ContentOutputSchema = z.object({
  title: z.string(),
  slug: z.string(),
  metaDescription: z.string(),
  outline: z.array(z.string()),
  body: z.string(),
  wordCount: z.number(),
});
export type ContentOutput = z.infer<typeof ContentOutputSchema>;

export const SeoOptimizationOutputSchema = z.object({
  seoScore: z.number().min(0).max(100),
  suggestions: z.array(z.string()),
  improvedBody: z.string(),
  improvedMetaDescription: z.string(),
});
export type SeoOptimizationOutput = z.infer<typeof SeoOptimizationOutputSchema>;

export const ReviewOutputSchema = z.object({
  score: z.number().min(0).max(10),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  feedback: z.string(),
  approved: z.boolean(),
});
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;

// ── Agent 1: Market Research ───────────────────────────────────────────────

export async function runMarketResearchAgent(
  topic: string,
  targetAudience: string,
  niche: string,
): Promise<{ output: MarketResearchOutput; tokens: number; cost: number }> {
  logger.info({ topic }, "Running Market Research Agent");
  const result = await callJson(
    MarketResearchOutputSchema,
    `You are an expert market research analyst specialising in digital marketing.
Analyse the given topic and produce structured market intelligence.
Return JSON with:
- marketTrends: 4-6 current trends in this space (array of strings)
- targetPersonas: 3-4 audience personas (array of strings, each one sentence)
- competitorAngles: 3-5 common angles competitors use (array of strings)
- contentAngles: 4-6 unique content angles that would stand out (array of strings)
- summary: 2-3 sentence executive summary of the market opportunity`,
    `Topic: ${topic}\nTarget audience: ${targetAudience}\nNiche: ${niche}`,
  );
  const cost = calcCost(MODEL, result.promptTokens, result.completionTokens);
  logger.info({ tokens: result.totalTokens, cost }, "Market Research Agent done");
  return { output: result.data, tokens: result.totalTokens, cost };
}

// ── Agent 2: SEO / Keyword Analysis ───────────────────────────────────────

export async function runKeywordAnalysisAgent(
  topic: string,
  contentAngles: string[],
  targetAudience: string,
): Promise<{ output: KeywordAnalysisOutput; tokens: number; cost: number }> {
  logger.info({ topic }, "Running Keyword Analysis Agent");
  const result = await callJson(
    KeywordAnalysisOutputSchema,
    `You are an expert SEO strategist. Analyse the topic and content angles to produce a comprehensive keyword strategy.
Return JSON with:
- primaryKeyword: the single best target keyword (string)
- secondaryKeywords: 5-8 supporting keywords (array of strings)
- lsiKeywords: 8-12 LSI/semantic keywords (array of strings)
- suggestedTitle: SEO-optimised H1 title (string, 50-60 chars)
- metaDescription: SEO meta description (string, 150-160 chars)
- keywordData: array of objects with keyword, intent (informational|commercial|transactional|navigational), difficulty (low|medium|high), volume (low|medium|high)
Include at least 8 items in keywordData.`,
    `Topic: ${topic}\nTarget audience: ${targetAudience}\nContent angles to target:\n${contentAngles.join("\n")}`,
  );
  const cost = calcCost(MODEL, result.promptTokens, result.completionTokens);
  logger.info({ tokens: result.totalTokens, cost }, "Keyword Analysis Agent done");
  return { output: result.data, tokens: result.totalTokens, cost };
}

// ── Agent 3: Content Creation ──────────────────────────────────────────────

export async function runContentAgent(
  topic: string,
  keywordData: KeywordAnalysisOutput,
  researchData: MarketResearchOutput,
  targetAudience: string,
): Promise<{ output: ContentOutput; tokens: number; cost: number }> {
  logger.info({ topic }, "Running Content Agent");
  const result = await callJson(
    ContentOutputSchema,
    `You are an expert content writer who creates high-quality, SEO-optimised blog posts.
Write a comprehensive, engaging article. Use the primary keyword naturally throughout.
Return JSON with:
- title: final article title (string)
- slug: URL slug (lowercase, hyphens only)
- metaDescription: final meta description (string)
- outline: array of H2 section headings (5-7 sections)
- body: full article body in markdown, 800-1200 words, includes intro, all sections with H2s, and conclusion
- wordCount: approximate word count (number)`,
    `Topic: ${topic}
Target audience: ${targetAudience}
Primary keyword: ${keywordData.primaryKeyword}
Secondary keywords: ${keywordData.secondaryKeywords.join(", ")}
LSI keywords: ${keywordData.lsiKeywords.join(", ")}
Suggested title: ${keywordData.suggestedTitle}
Key content angles: ${researchData.contentAngles.join(", ")}
Market summary: ${researchData.summary}`,
  );
  const cost = calcCost(MODEL, result.promptTokens, result.completionTokens);
  logger.info({ tokens: result.totalTokens, cost }, "Content Agent done");
  return { output: result.data, tokens: result.totalTokens, cost };
}

// ── Agent 3b: SEO Optimisation ─────────────────────────────────────────────

export async function runSeoOptimizationAgent(
  body: string,
  primaryKeyword: string,
  secondaryKeywords: string[],
  metaDescription: string,
): Promise<{ output: SeoOptimizationOutput; tokens: number; cost: number }> {
  logger.info({ primaryKeyword }, "Running SEO Optimization Agent");
  const result = await callJson(
    SeoOptimizationOutputSchema,
    `You are an expert on-page SEO specialist. Analyse and optimise the content for search engines.
Return JSON with:
- seoScore: current SEO score 0-100 (number)
- suggestions: list of specific improvements made or recommended (4-8 items, array of strings)
- improvedBody: full improved markdown body with keywords woven in naturally
- improvedMetaDescription: optimised meta description (150-160 chars)`,
    `Primary keyword: "${primaryKeyword}"
Secondary keywords: ${secondaryKeywords.join(", ")}
Current meta description: ${metaDescription}
---
Content to optimise:
${body}`,
  );
  const cost = calcCost(MODEL, result.promptTokens, result.completionTokens);
  logger.info({ tokens: result.totalTokens, cost }, "SEO Optimization Agent done");
  return { output: result.data, tokens: result.totalTokens, cost };
}

// ── Agent 4: Reviewer ──────────────────────────────────────────────────────

export async function runReviewerAgent(
  title: string,
  body: string,
  targetAudience: string,
  primaryKeyword: string,
): Promise<{ output: ReviewOutput; tokens: number; cost: number }> {
  logger.info({ title }, "Running Reviewer Agent");
  const result = await callJson(
    ReviewOutputSchema,
    `You are a senior content editor and quality reviewer. Critically evaluate the article.
Score on: accuracy, readability, SEO, engagement, structure, audience fit.
Return JSON with:
- score: overall quality score 0-10 (number with 1 decimal)
- strengths: 3-5 specific strengths (array of strings)
- weaknesses: 2-4 specific weaknesses or gaps (array of strings)
- feedback: 2-3 sentence editorial summary (string)
- approved: true if score >= 7.0, false otherwise (boolean)`,
    `Title: ${title}
Target audience: ${targetAudience}
Primary keyword: ${primaryKeyword}
---
Article body:
${body.slice(0, 3000)}`,
  );
  const cost = calcCost(MODEL, result.promptTokens, result.completionTokens);
  logger.info({ score: result.data.score, approved: result.data.approved, tokens: result.totalTokens, cost }, "Reviewer Agent done");
  return { output: result.data, tokens: result.totalTokens, cost };
}
