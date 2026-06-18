import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, organizationsTable } from "@workspace/db";
import { requireRole } from "../middleware/require-role";

const router: IRouter = Router();

router.get("/organizations", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId));
  res.json(org ? [org] : []);
});

router.get("/organizations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id !== req.user!.organizationId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, id));
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  res.json(org);
});

router.patch("/organizations/:id", requireRole(["owner", "admin"]), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id !== req.user!.organizationId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const { name, description } = req.body as { name?: string; description?: string };
  if (!name && !description) {
    res.status(400).json({ error: "name or description is required" });
    return;
  }

  const [org] = await db
    .update(organizationsTable)
    .set({ ...(name ? { name } : {}), ...(description ? { description } : {}) })
    .where(eq(organizationsTable.id, id))
    .returning();

  res.json(org);
});

export default router;
