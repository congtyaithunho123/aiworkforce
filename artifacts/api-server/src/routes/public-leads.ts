import { Router } from "express";
import { db } from "@workspace/db";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";

const router = Router();

const leadSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  company: z.string().optional(),
  phone: z.string().optional(),
  message: z.string().optional(),
  source: z.string().optional().default("contact_form"),
  website: z.string().optional(),
});

router.post("/marketing-leads", async (req, res) => {
  const parsed = leadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
  }

  const { name, email, company, phone, message, source, website } = parsed.data;

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS marketing_leads (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        company TEXT,
        phone TEXT,
        message TEXT,
        source TEXT DEFAULT 'contact_form',
        website TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      INSERT INTO marketing_leads (name, email, company, phone, message, source, website)
      VALUES (${name}, ${email}, ${company ?? null}, ${phone ?? null}, ${message ?? null}, ${source}, ${website ?? null})
    `);

    return res.json({ ok: true, message: "Lead received" });
  } catch (err) {
    console.error("[public-leads] error:", err);
    return res.status(500).json({ error: "Failed to save lead" });
  }
});

export default router;
