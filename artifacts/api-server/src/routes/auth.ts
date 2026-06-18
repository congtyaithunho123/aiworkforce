import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  organizationsTable,
  usersTable,
  refreshTokensTable,
  passwordResetTokensTable,
} from "@workspace/db";
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  generatePasswordResetToken,
  getPasswordResetTokenExpiry,
} from "../lib/auth";
import { authenticate } from "../middleware/authenticate";

const router = Router();

const RegisterBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  organizationName: z.string().min(1),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshBody = z.object({
  refreshToken: z.string().min(1),
});

const ForgotPasswordBody = z.object({
  email: z.string().email(),
});

const ResetPasswordBody = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, password, organizationName } = parsed.data;

  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()));

  if (existingUser) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const [org] = await db
    .insert(organizationsTable)
    .values({ name: organizationName })
    .returning();

  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(usersTable)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      name,
      role: "owner",
      organizationId: org.id,
    })
    .returning();

  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  });

  const refreshToken = generateRefreshToken();
  await db.insert(refreshTokensTable).values({
    userId: user.id,
    token: refreshToken,
    expiresAt: getRefreshTokenExpiry(),
  });

  req.log.info({ userId: user.id, orgId: org.id }, "User registered");
  res.status(201).json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    },
    organization: { id: org.id, name: org.name },
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()));

  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, user.organizationId));

  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  });

  const refreshToken = generateRefreshToken();
  await db.insert(refreshTokensTable).values({
    userId: user.id,
    token: refreshToken,
    expiresAt: getRefreshTokenExpiry(),
  });

  req.log.info({ userId: user.id }, "User logged in");
  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    },
    organization: org ? { id: org.id, name: org.name } : null,
  });
});

router.post("/auth/refresh", async (req, res): Promise<void> => {
  const parsed = RefreshBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [stored] = await db
    .select()
    .from(refreshTokensTable)
    .where(eq(refreshTokensTable.token, parsed.data.refreshToken));

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  await db
    .update(refreshTokensTable)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokensTable.id, stored.id));

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, stored.userId));

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  });

  const newRefreshToken = generateRefreshToken();
  await db.insert(refreshTokensTable).values({
    userId: user.id,
    token: newRefreshToken,
    expiresAt: getRefreshTokenExpiry(),
  });

  res.json({ accessToken, refreshToken: newRefreshToken });
});

router.post("/auth/logout", authenticate, async (req, res): Promise<void> => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) {
    await db
      .update(refreshTokensTable)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokensTable.token, refreshToken));
  }
  res.json({ success: true });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email.toLowerCase()));

  if (!user) {
    res.json({ message: "If that email is registered, a reset link has been sent." });
    return;
  }

  const token = generatePasswordResetToken();
  await db.insert(passwordResetTokensTable).values({
    userId: user.id,
    token,
    expiresAt: getPasswordResetTokenExpiry(),
  });

  req.log.info({ userId: user.id }, "Password reset token generated");
  res.json({
    message: "If that email is registered, a reset link has been sent.",
    debug_token: process.env.NODE_ENV !== "production" ? token : undefined,
  });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [stored] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(eq(passwordResetTokensTable.token, parsed.data.token));

  if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, stored.userId));

  await db
    .update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokensTable.id, stored.id));

  res.json({ message: "Password reset successfully" });
});

router.get("/auth/me", authenticate, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, user.organizationId));

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    },
    organization: org ? { id: org.id, name: org.name } : null,
  });
});

router.put("/auth/profile", authenticate, async (req, res): Promise<void> => {
  const { name } = req.body as { name?: string };
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ name })
    .where(eq(usersTable.id, req.user!.userId))
    .returning();

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
  });
});

router.put("/auth/change-password", authenticate, async (req, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, user.id));

  res.json({ message: "Password changed successfully" });
});

export default router;
