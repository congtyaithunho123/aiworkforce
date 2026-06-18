import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  JWT_SECRET = "dev-only-insecure-secret-do-not-use-in-production";
  console.warn("[auth] WARNING: JWT_SECRET not set — using insecure dev fallback. Set JWT_SECRET as a secret before deploying.");
}

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  organizationId: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET as string) as JWTPayload;
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString("hex");
}

export function getRefreshTokenExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return d;
}

export function generatePasswordResetToken(): string {
  return randomBytes(32).toString("hex");
}

export function getPasswordResetTokenExpiry(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  return d;
}
