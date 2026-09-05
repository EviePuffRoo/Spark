import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomInt, createHmac } from "node:crypto";
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

// A deterministic digest of a code, for the one case that needs to *find* a
// row by its code rather than verify a code against a known row (world join
// codes). bcrypt can't do that — it salts per hash, so the only way to
// resolve a submitted code against salted hashes is to try them one at a
// time, which costs a bcrypt comparison per candidate row.
//
// Keyed with the server's own secret so the stored digest is useless to
// anyone who only has the database: without the key there's nothing to
// precompute against. Unlike bcrypt this is deliberately fast — it's an
// index, not a password check, and the code it digests is 16 characters
// from a 31-character alphabet (~4e23 combinations), far past brute force.
// The bcrypt hash still performs the actual verification afterwards.
//
// Rotating JWT_SECRET invalidates existing lookup values; that degrades to
// the same scan this replaced (see routes/worlds.ts) rather than breaking
// anything, and repairs itself as codes are reissued.
export function codeLookupDigest(code: string): string {
  return createHmac("sha256", JWT_SECRET).update(normalizeRecoveryCode(code)).digest("hex");
}

// A precomputed bcrypt hash of a value nobody will ever type. Login and
// reset-password both look up a user by username and then verify a
// password/recovery code against that user's hash — if the route only
// calls bcrypt.compare when a user was actually found, a nonexistent
// username returns near-instantly while a real one takes the full ~100ms
// bcrypt comparison, and that timing difference alone reveals which
// usernames exist. Passing this in place of a missing hash keeps the
// comparison — and its cost — unconditional either way.
export const DECOY_HASH = "$2b$10$NlSUvVqklX5y7e9pLce4pOUqgkvOmgOrgCAz01O7/YNc9jxtIwjMG";

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
    // RENDER is the confirmed signal for today's actual deployment (Render
    // sets it on every service); NODE_ENV === "production" is included too
    // so the cookie still ships Secure if this ever runs somewhere else
    // that sets NODE_ENV but not a Render-specific var, rather than
    // silently falling back to plain HTTP there.
    secure: process.env.RENDER === "true" || process.env.NODE_ENV === "production",
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
