import type { NextFunction, Request, Response } from "express";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "./db.js";

const KEY_PREFIX_LENGTH = 8;

// keyHash is a plain SHA-256 hex digest, not bcrypt — the raw key already
// carries 256 bits of its own entropy, so a fast indexed equality lookup
// on the hash is exactly as safe as a slow deliberately-non-indexed hash
// would be here, and every public request needs one.
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

// Returns the raw key (shown to the caller exactly once) alongside the
// values actually persisted — never store or log the raw key itself.
export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const rawKey = `spark_${randomBytes(32).toString("hex")}`;
  return { rawKey, keyHash: hashApiKey(rawKey), keyPrefix: rawKey.slice(0, KEY_PREFIX_LENGTH) };
}

declare global {
  namespace Express {
    interface Request {
      apiKeyId?: string;
    }
  }
}

// Gates the /api/v1/public/... surface: reads Authorization: Bearer <key>,
// hashes it, and looks up the owning ApiKey row by that hash. Sets
// req.userId to the key's owner (not a session) — reusing req.userId lets
// every public handler reuse the exact same Prisma `where` shapes and DTOs
// the cookie-authed routes already use, and an API key's owner always gets
// their own full, unredacted view (never the party-redacted one a shared
// world member sees), same as calling the cookie-authed endpoints directly.
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const rawKey = typeof header === "string" && header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
  if (!rawKey) return res.status(401).json({ error: "Missing Authorization: Bearer <key> header" });

  const keyHash = hashApiKey(rawKey);
  const key = await prisma.apiKey.findUnique({ where: { keyHash } });
  // timingSafeEqual guards the hash comparison itself against a timing
  // side-channel; it needs a real row to compare against, so a miss falls
  // through to the same 401 either way — same 404-both-ways spirit as the
  // entity-write checks, just for "does this key exist" instead.
  if (!key || !key.enabled || !timingSafeEqual(Buffer.from(key.keyHash), Buffer.from(keyHash))) {
    return res.status(401).json({ error: "Invalid or disabled API key" });
  }

  req.userId = key.userId;
  req.apiKeyId = key.id;
  void prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  next();
}
