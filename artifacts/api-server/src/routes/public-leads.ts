import { Router } from "express";
import { db, marketingLeadsTable } from "@workspace/db";
import { z } from "zod/v4";

const router = Router();

const leadSchema = z.object({
  name: z.string().optional(),
  email: z.email(),
  company: z.string().optional(),
  phone: z.string().optional(),
  message: z.string().optional(),
  source: z.string().optional().default("contact_form"),
  website: z.string().optional(),
  websiteAnalyzed: z.string().optional(),
});

router.post("/marketing-leads", async (req, res) => {
  const parsed = leadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
  }

  const { name, email, company, phone, message, source, website, websiteAnalyzed } = parsed.data;

  try {
    await db.insert(marketingLeadsTable).values({
      name: name ?? null,
      email,
      company: company ?? null,
      phone: phone ?? null,
      message: message ?? null,
      source: source ?? "contact_form",
      websiteAnalyzed: websiteAnalyzed ?? website ?? null,
    });

    return res.json({ ok: true, message: "Lead received" });
  } catch (err) {
    console.error("[public-leads] error:", err);
    return res.status(500).json({ error: "Failed to save lead" });
  }
});

export default router;
