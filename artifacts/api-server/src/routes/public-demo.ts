import { Router } from "express";
import { z } from "zod/v4";
import dns from "node:dns/promises";
import net from "node:net";
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

/* ── SSRF protection ─────────────────────────────────────────── */

/** Regex patterns that match private/reserved IP ranges */
const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^127\./,                                    // loopback 127.0.0.0/8
  /^0\./,                                      // unspecified 0.x.x.x
  /^10\./,                                     // private 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./,               // private 172.16-31.x
  /^192\.168\./,                               // private 192.168.0.0/16
  /^169\.254\./,                               // link-local 169.254.0.0/16 (AWS metadata)
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64.0.0/10
  /^198\.(1[89])\./,                           // benchmark 198.18/19
  /^::1$/,                                     // IPv6 loopback
  /^fe80:/i,                                   // IPv6 link-local
  /^fc[0-9a-f]{2}:/i,                          // IPv6 unique local fc00/7
  /^fd[0-9a-f]{2}:/i,                          // IPv6 unique local fd00/8
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.aws.internal",
  "169.254.169.254",       // AWS/GCP/Azure metadata IP
  "instance-data",
]);

/** Returns true if the IP string belongs to a private/reserved range */
function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some(re => re.test(ip));
}

/**
 * Validates and normalises a user-supplied URL for SSRF safety.
 * Throws with a human-readable message if the URL is disallowed.
 */
async function validateAndNormalise(rawUrl: string): Promise<string> {
  const href = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
    ? rawUrl
    : `https://${rawUrl}`;

  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    throw new Error("URL không hợp lệ");
  }

  // Allow only safe protocols
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Chỉ hỗ trợ http và https");
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block explicitly listed hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error("Hostname không được phép");
  }

  // Block hostnames ending in .local / .internal / .localhost
  if (/\.(local|internal|localhost|intranet)$/i.test(hostname)) {
    throw new Error("Hostname nội bộ không được phép");
  }

  // If hostname is a bare IP, check immediately
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new Error("Địa chỉ IP nội bộ không được phép");
    }
    return parsed.href;
  }

  // Resolve hostname → IPs, reject if any resolve to a private range
  try {
    const [ipv4Addresses] = await Promise.allSettled([
      dns.resolve4(hostname),
    ]);

    if (ipv4Addresses.status === "fulfilled") {
      for (const addr of ipv4Addresses.value) {
        if (isPrivateIP(addr)) {
          throw new Error("Domain trỏ đến địa chỉ IP nội bộ");
        }
      }
    }
  } catch (err) {
    if (err instanceof Error && /không được phép|nội bộ|trỏ đến/.test(err.message)) {
      throw err; // our own validation error — rethrow
    }
    // DNS resolution failure is non-fatal; fetch() will handle it
  }

  return parsed.href;
}

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
  // Validate and sanitise first — throws if SSRF attempt detected
  const safeUrl = await validateAndNormalise(rawUrl);

  let html = "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(safeUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SalesBot/1.0; +https://aiworkforce.vn)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "error",  // never follow redirects — prevents SSRF bypass via open redirects
    });
    clearTimeout(timeout);

    if (res.ok) {
      const text = await res.text();
      html = text.slice(0, 30000);
    }
  } catch (err) {
    if (err instanceof Error && /không được phép|nội bộ|trỏ đến/.test(err.message)) throw err;
    // other fetch errors (network, timeout) — fall through with empty html
  }

  const extract = (pattern: RegExp): string =>
    (pattern.exec(html)?.[1] ?? "").trim()
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .slice(0, 300);

  const title       = extract(/<title[^>]*>([^<]+)<\/title>/i);
  const description = extract(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || extract(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const ogTitle     = extract(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || extract(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const ogDesc      = extract(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || extract(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  const siteName    = extract(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
    || extract(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
  const keywords    = extract(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i);

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

  return { url: safeUrl, title, description: effectiveDescription, siteName, ogTitle, keywords, raw };
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
    // Step 1: validate URL for SSRF + fetch real metadata
    let meta: SiteMetadata;
    try {
      meta = await fetchSiteMetadata(website);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // SSRF / validation errors are 400 not 500
      if (/không hợp lệ|không được phép|nội bộ|trỏ đến|hỗ trợ/.test(msg)) {
        return res.status(400).json({ error: `Website không hợp lệ: ${msg}` });
      }
      // Fetch/network failure — still run AI with empty metadata
      meta = { url: website, title: "", description: "", siteName: "", ogTitle: "", keywords: "", raw: "" };
    }

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

    // Step 3: parse and validate AI output with Zod
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
