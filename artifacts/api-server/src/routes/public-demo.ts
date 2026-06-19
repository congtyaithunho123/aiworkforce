import { Router } from "express";
import { z } from "zod/v4";
import { runCompletion } from "../lib/ai-service";

const router = Router();

const analyzeSchema = z.object({
  website: z.string().min(1),
});

/* ── Zod schema for AI response validation ───────────────────── */
const leadSchema = z.object({
  name: z.string(),
  title: z.string(),
  company: z.string(),
  email: z.string(),
  reason: z.string(),
});

const demoResultSchema = z.object({
  company: z.object({
    name: z.string(),
    industry: z.string(),
    product: z.string(),
    targetMarket: z.string(),
    painPoints: z.array(z.string()).min(1),
    companySize: z.string().optional(),
  }),
  icp: z.object({
    title: z.string(),
    companySize: z.string(),
    industry: z.string(),
    painPoints: z.array(z.string()).min(1),
    decisionMaker: z.string(),
    budget: z.string().optional(),
  }),
  leads: z.array(leadSchema).min(1).max(5),
  email: z.object({
    subject: z.string(),
    body: z.string(),
  }),
});

/* ── Website metadata fetcher ────────────────────────────────── */
interface SiteMetadata {
  url: string;
  title: string;
  description: string;
  siteName: string;
  ogTitle: string;
  keywords: string;
  raw: string;
}

async function fetchSiteMetadata(rawUrl: string): Promise<SiteMetadata> {
  const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;

  let html = "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SalesBot/1.0; +https://aiworkforce.vn)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (res.ok) {
      const text = await res.text();
      html = text.slice(0, 30000);
    }
  } catch {
    // fetch failed — continue with empty html, AI will infer from URL
  }

  const extract = (pattern: RegExp): string =>
    (pattern.exec(html)?.[1] ?? "").trim().replace(/&amp;/g, "&").replace(/&quot;/g, '"').slice(0, 300);

  const title      = extract(/<title[^>]*>([^<]+)<\/title>/i);
  const description = extract(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || extract(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const ogTitle    = extract(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || extract(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const ogDesc     = extract(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || extract(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  const siteName   = extract(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
    || extract(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
  const keywords   = extract(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i);

  const effectiveDescription = ogDesc || description;
  const raw = [
    title && `Title: ${title}`,
    siteName && `Site name: ${siteName}`,
    effectiveDescription && `Description: ${effectiveDescription}`,
    ogTitle && ogTitle !== title && `OG title: ${ogTitle}`,
    keywords && `Keywords: ${keywords}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { url, title, description: effectiveDescription, siteName, ogTitle, keywords, raw };
}

/* ── Prompt builder ──────────────────────────────────────────── */
function buildPrompt(website: string, meta: SiteMetadata): string {
  const metaSection = meta.raw
    ? `Here is metadata extracted directly from the website:\n${meta.raw}\n\n`
    : "No metadata could be fetched — infer from the domain name.\n\n";

  return `You are an AI Sales Development Representative (SDR) analyzing a company website to generate sales intelligence.

Website URL: ${website}
${metaSection}Based on the above information, generate a comprehensive sales analysis in JSON format with this exact structure:
{
  "company": {
    "name": "Company Name",
    "industry": "Industry/Sector",
    "product": "What the company sells in 1-2 sentences",
    "targetMarket": "Who their customers are",
    "painPoints": ["pain point 1", "pain point 2", "pain point 3"],
    "companySize": "Estimated size (e.g. 50-200 employees)"
  },
  "icp": {
    "title": "Primary buyer title (e.g. Head of Sales, VP Marketing)",
    "companySize": "Target company size (e.g. 50-500 employees)",
    "industry": "Target industries (comma-separated)",
    "painPoints": ["buyer pain point 1", "buyer pain point 2", "buyer pain point 3"],
    "decisionMaker": "Who signs the deal",
    "budget": "Estimated budget range"
  },
  "leads": [
    {
      "name": "Full Vietnamese Name",
      "title": "Job Title",
      "company": "Company Name Vietnam",
      "email": "email@company.vn",
      "reason": "Why this person is a good fit"
    }
  ],
  "email": {
    "subject": "Email subject line",
    "body": "Full personalized email body in Vietnamese, 150-200 words, to the first lead"
  }
}

Rules:
- Generate EXACTLY 5 leads — no more, no fewer
- Use realistic Vietnamese names and Vietnamese company names
- Emails should look realistic (firstname.lastname@company.vn format)
- The email body must be in Vietnamese and reference specific details from the company being analyzed
- Make all content highly relevant to the website metadata provided above
- Output ONLY valid JSON, no markdown`;
}

/* ── Route handler ───────────────────────────────────────────── */
router.post("/public/demo/analyze", async (req, res) => {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Thiếu trường website" });
  }

  const { website } = parsed.data;

  try {
    // Step 1: fetch real metadata from the website
    const meta = await fetchSiteMetadata(website);

    // Step 2: call AI with real metadata in context
    const completion = await runCompletion(
      [
        {
          role: "system",
          content:
            "You are a B2B sales intelligence AI. Generate realistic, detailed sales analysis. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: buildPrompt(website, meta),
        },
      ],
      {
        model: "gpt-4o-mini",
        outputFormat: "json",
      }
    );

    // Step 3: parse and validate with Zod
    let rawData: unknown;
    try {
      rawData = JSON.parse(completion.content);
    } catch {
      throw new Error("AI returned invalid JSON");
    }

    const validation = demoResultSchema.safeParse(rawData);
    if (!validation.success) {
      throw new Error(
        `AI response failed schema validation: ${validation.error.issues.map(i => i.message).join(", ")}`
      );
    }

    const data = validation.data;

    // Ensure exactly 5 leads
    if (data.leads.length < 5) {
      throw new Error(`AI only generated ${data.leads.length} leads (need 5)`);
    }
    const trimmedData = { ...data, leads: data.leads.slice(0, 5) };

    return res.json({
      ok: true,
      data: trimmedData,
      meta: {
        tokensUsed: completion.totalTokens,
        model: completion.model,
        websiteTitle: meta.title || null,
      },
    });
  } catch (err) {
    console.error("[demo-analyze] error:", err);
    return res.status(500).json({
      error: "Phân tích thất bại. Vui lòng thử lại.",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
