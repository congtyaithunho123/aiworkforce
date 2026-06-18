import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, skillsTable } from "@workspace/db";
import { z } from "zod/v4";

const router: IRouter = Router();

const SkillBody = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  inputSchema: z.string().optional(),
  outputSchema: z.string().optional(),
});

router.get("/skills", async (_req, res): Promise<void> => {
  const skills = await db.select().from(skillsTable).orderBy(skillsTable.createdAt);
  res.json(skills);
});

router.post("/skills", async (req, res): Promise<void> => {
  const parsed = SkillBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [skill] = await db.insert(skillsTable).values(parsed.data).returning();
  res.status(201).json(skill);
});

router.put("/skills/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = SkillBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [skill] = await db
    .update(skillsTable)
    .set(parsed.data)
    .where(eq(skillsTable.id, id))
    .returning();

  if (!skill) { res.status(404).json({ error: "Skill not found" }); return; }
  res.json(skill);
});

router.delete("/skills/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(skillsTable).where(eq(skillsTable.id, id));
  res.json({ success: true });
});

export default router;
