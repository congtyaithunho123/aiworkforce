import { Router, type IRouter } from "express";
import { db, organizationsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/organizations", async (req, res): Promise<void> => {
  req.log.info("Listing organizations");
  const orgs = await db.select().from(organizationsTable).orderBy(organizationsTable.createdAt);
  res.json(orgs);
});

router.post("/organizations", async (req, res): Promise<void> => {
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [org] = await db
    .insert(organizationsTable)
    .values({ name, ...(description ? { description } : {}) })
    .returning();
  req.log.info({ orgId: org.id }, "Organization created");
  res.status(201).json(org);
});

export default router;
