import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/auth";

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Support Bearer header (normal) OR ?token=... query param (SSE/EventSource)
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else if (typeof req.query.token === "string") {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ error: "Missing or invalid Authorization" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired access token" });
  }
}
