import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import { db, providerKeysTable } from "@workspace/db";

const router = Router();

const CreateKeyBody = z.object({
  provider: z.enum(["openai", "anthropic"]).default("openai"),
  label: z.string().min(1).default("Default"),
  apiKey: z.string().min(10),
});

// GET /provider-keys
router.get("/provider-keys", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const keys = await db
    .select({
      id: providerKeysTable.id,
      provider: providerKeysTable.provider,
      label: providerKeysTable.label,
      keyPreview: providerKeysTable.keyPreview,
      isActive: providerKeysTable.isActive,
      createdAt: providerKeysTable.createdAt,
    })
    .from(providerKeysTable)
    .where(eq(providerKeysTable.organizationId, orgId));
  res.json(keys);
});

// POST /provider-keys
router.post("/provider-keys", async (req, res): Promise<void> => {
  const parsed = CreateKeyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const orgId = req.user!.organizationId;
  const { provider, label, apiKey } = parsed.data;

  // Deactivate existing keys for this provider
  await db.update(providerKeysTable)
    .set({ isActive: false })
    .where(and(
      eq(providerKeysTable.organizationId, orgId),
      eq(providerKeysTable.provider, provider),
    ));

  const keyPreview = apiKey.slice(0, 7) + "..." + apiKey.slice(-4);

  const [key] = await db.insert(providerKeysTable).values({
    organizationId: orgId,
    provider,
    label,
    encryptedKey: apiKey,
    keyPreview,
    isActive: true,
  }).returning({
    id: providerKeysTable.id,
    provider: providerKeysTable.provider,
    label: providerKeysTable.label,
    keyPreview: providerKeysTable.keyPreview,
    isActive: providerKeysTable.isActive,
    createdAt: providerKeysTable.createdAt,
  });

  res.status(201).json(key);
});

// DELETE /provider-keys/:id
router.delete("/provider-keys/:id", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const id = parseInt(req.params.id);

  await db.delete(providerKeysTable).where(and(
    eq(providerKeysTable.id, id),
    eq(providerKeysTable.organizationId, orgId),
  ));
  res.json({ success: true });
});

// GET /provider-keys/active — used by AI service to resolve which key to use
router.get("/provider-keys/active", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const [key] = await db
    .select()
    .from(providerKeysTable)
    .where(and(
      eq(providerKeysTable.organizationId, orgId),
      eq(providerKeysTable.provider, "openai"),
      eq(providerKeysTable.isActive, true),
    ));
  // Return whether custom key exists (not the key itself)
  res.json({ hasCustomKey: !!key, provider: key?.provider ?? null });
});

export default router;
