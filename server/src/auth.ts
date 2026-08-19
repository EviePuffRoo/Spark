import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomInt } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

// render.yaml generates a real JWT_SECRET for the deployed service (Render
// sets RENDER=true itself, same signal setSessionCookie below already uses
// to know it's live) — refusing to boot without one there means a missing
// or accidentally-cleared env var fails loudly at deploy time instead of
// silently serving every session signed with a secret that's sitting in
// this public repo. Local dev keeps the convenience fallback.
if (process.env.RENDER === "true" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in the deployed environment — refusing to start with the fallback dev secret.");
}
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-me";
const COOKIE_NAME = "spark_session";
const TOKEN_TTL = "30d";

// Excludes visually ambiguous characters (0/O, 1/I/L).
const RECOVERY_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateRecoveryCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < 4; g++) {
    let group = "";
    for (let i = 0; i < 4; i++) {
      group += RECOVERY_CODE_ALPHABET[randomInt(RECOVERY_CODE_ALPHABET.length)];
    }
    groups.push(group);
  }
  return groups.join("-");
}

function normalizeRecoveryCode(code: string): string {
  return code.trim().toUpperCase();
}

export function hashRecoveryCode(code: string): Promise<string> {
  return bcrypt.hash(normalizeRecoveryCode(code), 10);
}

export function verifyRecoveryCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(normalizeRecoveryCode(code), hash);
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.RENDER === "true",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME);
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  const userId = typeof token === "string" ? verifyToken(token) : null;
  if (!userId) return res.status(401).json({ error: "Not signed in" });
  req.userId = userId;
  next();
}
