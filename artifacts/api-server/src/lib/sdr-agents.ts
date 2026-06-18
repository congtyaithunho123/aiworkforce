import { z } from "zod/v4";
import OpenAI from "openai";
import { logger } from "./logger";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = "gpt-4o-mini";

const MODEL_COSTS: Record<string, { prompt: number; completion: number }> = {
  "gpt-4o":       { prompt: 0.0025,  completion: 0.01 },
  "gpt-4o-mini":  { prompt: 0.00015, completion: 0.0006 },
};

export function calcCost(model: string, promptTokens: number, completionTokens: number): number {
  const rates = MODEL_COSTS[model] ?? { prompt: 0.001, completion: 0.002 };
  return (promptTokens / 1000) * rates.prompt + (completionTokens / 1000) * rates.completion;
}

async function callJson<T extends z.ZodTypeAny>(
  schema: T,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ data: z.infer<T>; promptTokens: number; completionTokens: number; totalTokens: number }> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt + "\n\nRespond with valid JSON only. No markdown, no explanation." },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    max_tokens: 4096,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);
  const validated = schema.parse(parsed);

  return {
    data: validated,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
  };
}

// ── Schemas ────────────────────────────────────────────────────────────────

export const CompanyResearchOutputSchema = z.object({
  industry: z.string(),
  icp: z.string(),
  painPoints: z.array(z.string()),
  competitors: z.array(z.string()),
});
export type CompanyResearchOutput = z.infer<typeof CompanyResearchOutputSchema>;

export const LeadSchema = z.object({
  name: z.string(),
  company: z.string(),
  title: z.string(),
  reason: z.string(),
});

export const LeadGenerationOutputSchema = z.object({
  leads: z.array(LeadSchema),
});
export type LeadGenerationOutput = z.infer<typeof LeadGenerationOutputSchema>;

export const OutreachEmailSchema = z.object({
  subject: z.string(),
  email: z.string(),
});
export type OutreachEmail = z.infer<typeof OutreachEmailSchema>;

export const FollowUpEmailsSchema = z.object({
  followup2: z.string(),
  followup3: z.string(),
  followup4: z.string(),
});
export type FollowUpEmails = z.infer<typeof FollowUpEmailsSchema>;

// ── Agent 1: Company Research ──────────────────────────────────────────────

export async function runCompanyResearchAgent(
  website: string,
  productDescription: string,
): Promise<{ output: CompanyResearchOutput; tokens: number; cost: number }> {
  logger.info({ website }, "Running Company Research Agent");

  const result = await callJson(
    CompanyResearchOutputSchema,
    `You are an expert B2B sales researcher. Given a company website and product description, analyze the company deeply.
Return a JSON object with:
- industry: the company's industry vertical (string)
- icp: ideal customer profile description — who would benefit most from this product (string)
- painPoints: list of 3-5 specific pain points this product addresses (array of strings)
- competitors: list of 3-5 known competitors in this space (array of strings)`,
    `Company website: ${website}\n\nProduct/service description: ${productDescription}`,
  );

  const cost = calcCost(MODEL, result.promptTokens, result.completionTokens);
  logger.info({ website, tokens: result.totalTokens, cost }, "Company Research Agent completed");

  return { output: result.data, tokens: result.totalTokens, cost };
}

// ── Agent 2: Lead Generation ───────────────────────────────────────────────

export async function runLeadGenerationAgent(
  icp: string,
  industry: string,
  painPoints: string[],
  targetCompany: string,
  count = 10,
): Promise<{ output: LeadGenerationOutput; tokens: number; cost: number }> {
  logger.info({ icp }, "Running Lead Generation Agent");

  const result = await callJson(
    LeadGenerationOutputSchema,
    `You are an expert B2B lead generation specialist. Generate realistic, plausible leads based on an ICP.
Return a JSON object with a "leads" array. Each lead must have:
- name: realistic full name
- company: realistic company name fitting the ICP
- title: job title (decision maker or influencer)
- reason: specific reason why this person is a good fit (1-2 sentences)`,
    `ICP: ${icp}
Industry: ${industry}
Pain points this product solves: ${painPoints.join(", ")}
Selling to companies similar to: ${targetCompany}
Generate exactly ${count} high-quality leads.`,
  );

  const cost = calcCost(MODEL, result.promptTokens, result.completionTokens);
  logger.info({ leads: result.data.leads.length, tokens: result.totalTokens, cost }, "Lead Generation Agent completed");

  return { output: result.data, tokens: result.totalTokens, cost };
}

// ── Agent 3: Outreach Email ────────────────────────────────────────────────

export async function runOutreachAgent(
  companyProfile: { website: string; icp: string; painPoints: string[]; industry: string },
  leadProfile: { name: string; company: string; title: string; reason: string },
): Promise<{ output: OutreachEmail; tokens: number; cost: number }> {
  logger.info({ lead: leadProfile.name }, "Running Outreach Agent");

  const result = await callJson(
    OutreachEmailSchema,
    `You are an expert B2B cold email copywriter. Write highly personalized, concise outreach emails that get replies.
Rules:
- Subject line: compelling, under 50 chars, no clickbait
- Email body: 3-4 short paragraphs, under 150 words total
- Personalize to the lead's title and company
- Reference a specific pain point
- End with a clear, low-friction CTA (e.g., "Worth a 15-min call this week?")
- No salesy buzzwords, no "I hope this email finds you well"
Return JSON with "subject" and "email" fields.`,
    `Company profile:
- Website: ${companyProfile.website}
- Industry: ${companyProfile.industry}
- ICP: ${companyProfile.icp}
- Pain points addressed: ${companyProfile.painPoints.join(", ")}

Lead profile:
- Name: ${leadProfile.name}
- Title: ${leadProfile.title}
- Company: ${leadProfile.company}
- Why they're a fit: ${leadProfile.reason}`,
  );

  const cost = calcCost(MODEL, result.promptTokens, result.completionTokens);
  logger.info({ lead: leadProfile.name, tokens: result.totalTokens, cost }, "Outreach Agent completed");

  return { output: result.data, tokens: result.totalTokens, cost };
}

// ── Agent 4: Follow-up Emails ──────────────────────────────────────────────

export async function runFollowUpAgent(
  originalEmail: string,
  leadProfile: { name: string; company: string; title: string },
): Promise<{ output: FollowUpEmails; tokens: number; cost: number }> {
  logger.info({ lead: leadProfile.name }, "Running Follow-up Agent");

  const result = await callJson(
    FollowUpEmailsSchema,
    `You are an expert B2B cold email follow-up specialist. Write 3 follow-up emails for a cold outreach sequence.
Rules:
- followup2 (Day 3): short, gentle bump, add a new insight or value point
- followup3 (Day 7): add social proof or case study angle, still concise
- followup4 (Day 14): "break-up" email, low pressure, keep the door open
Each email should be under 80 words. Plain text only. No subject lines needed.
Return JSON with "followup2", "followup3", "followup4" fields.`,
    `Original outreach email:
${originalEmail}

Lead: ${leadProfile.name} (${leadProfile.title} at ${leadProfile.company})`,
  );

  const cost = calcCost(MODEL, result.promptTokens, result.completionTokens);
  logger.info({ lead: leadProfile.name, tokens: result.totalTokens, cost }, "Follow-up Agent completed");

  return { output: result.data, tokens: result.totalTokens, cost };
}
