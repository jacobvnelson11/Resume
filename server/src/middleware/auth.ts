import type { NextFunction, Request, Response } from "express";

/**
 * Single-user password gate (PRD section 8: "Auth" -- no multi-tenant needs).
 * If APP_PASSWORD is unset, auth is a no-op for local dev.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return next();

  if (req.session?.authenticated) return next();

  return res.status(401).json({ error: "Not authenticated" });
}
