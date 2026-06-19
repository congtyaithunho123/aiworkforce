import { Router } from "express";
import { z } from "zod/v4";
import { runCompletion } from "../lib/ai-service";

const router = Router();

const analyzeSchema = z.object({
  website: z.string().min(1),
});

const DEMO_PROMPT = (website: string) => `You are an AI Sales Development Representative (SDR) analyzing a company website to generate sales intelligence.

Website/Company: ${website}

Based on this company, generate a comprehensive sales analysis in JSON format with this exact structure:
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
- Generate exactly 5 leads - use realistic Vietnamese names and Vietnamese company names
- Emails should look realistic (firstname.lastname@company.vn format)
- The email body should be in Vietnamese and reference the specific company being analyzed
- Make all content highly relevant to the website/company provided
- If you cannot determine the exact company from the URL, make educated inferences based on the domain name
- Output ONLY valid JSON, no markdown`;

router.post("/public/demo/analyze", async (req, res) => {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Thiếu trường website" });
  }

  const { website } = parsed.data;

  try {
    const result = await runCompletion(
      [
        {
          role: "system",
          content: "You are a B2B sales intelligence AI. Generate realistic, detailed sales analysis. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: DEMO_PROMPT(website),
        },
      ],
      {
        model: "gpt-4o-mini",
        outputFormat: "json",
      }
    );

    const data = JSON.parse(result.content);

    if (!data.company || !data.icp || !data.leads || !data.email) {
      throw new Error("Incomplete AI response structure");
    }

    if (!Array.isArray(data.leads) || data.leads.length === 0) {
      throw new Error("No leads generated");
    }

    return res.json({
      ok: true,
      data,
      meta: {
        tokensUsed: result.totalTokens,
        model: result.model,
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
