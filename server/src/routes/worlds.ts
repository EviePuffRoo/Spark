import { Router } from "express";
import { prisma } from "../db.js";
import { generateRecoveryCode, hashRecoveryCode, verifyRecoveryCode, codeLookupDigest } from "../auth.js";
import { getMemberWorldIds, canWriteWorld } from "../worldAccess.js";
import { FREE_TIER_WORLD_LIMIT, type WorldMemberRole, type HouseRules } from "@spark/shared";
import { seedStarterWorld } from "../seedStarterWorld.js";

export const worldsRouter = Router();

const WORLD_MEMBER_ROLES: WorldMemberRole[] = ["player", "coDM"];
function isWorldMemberRole(value: unknown): value is WorldMemberRole {
  return typeof value === "string" && (WORLD_MEMBER_ROLES as string[]).includes(value);
}

// Whitelist-coerces a House Rules payload to the known, bounded set of
// tunable overrides — see shared/src/rulesets/houseRules.ts. Anything not
// a positive finite number for a known key is silently dropped, same
// "trust the shape, coerce what's reasonable" posture as this app's other
// coerce* helpers, rather than 400ing the whole request over one bad field.
const HOUSE_RULE_KEYS = ["carryCapacityMultiplier", "pointBuyBudget", "encounterDifficultyMultiplier"] as const;
function coerceHouseRules(raw: unknown): HouseRules {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const result: HouseRules = {};
  for (const key of HOUSE_RULE_KEYS) {
    const value = r[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) result[key] = value;
  }
  return result;
}

const COUNT_SELECT = {
  characters: true, items: true, locations: true, questHooks: true,
  factions: true, encounterTables: true, sessionNotes: true, adventures: true,
  playerCharacters: true,
};

function toSummary(
  row: { id: string; name: string; description: string | null; nextSessionAt: Date | null; currentDay: number; houseRules: string; createdAt: Date; updatedAt: Date; _count: Record<string, number> },
  isOwner: boolean,
  ownerUsername?: string,
  canWrite = true
) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    nextSessionAt: row.nextSessionAt?.toISOString(),
    currentDay: row.currentDay,
    houseRules: coerceHouseRules(JSON.parse(row.houseRules)),
    isOwner,
    canWrite,
    ownerUsername,
    characterCount: row._count.characters,
    itemCount: row._count.items,
    locationCount: row._count.locations,
    questCount: row._count.questHooks,
    factionCount: row._count.factions,
    encounterTableCount: row._count.encounterTables,
    sessionNoteCount: row._count.sessionNotes,
    adventureCount: row._count.adventures,
    playerCharacterCount: row._count.playerCharacters,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

worldsRouter.get("/", async (req, res) => {
  const [owned, memberships] = await Promise.all([
    prisma.world.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: COUNT_SELECT } },
    }),
    prisma.worldMember.findMany({
      where: { userId: req.userId },
      include: { world: { include: { _count: { select: COUNT_SELECT }, user: { select: { username: true } } } } },
    }),
  ]);

  const ownedSummaries = owned.map((row) => toSummary(row, true));
  const sharedSummaries = memberships.map((m) => toSummary(m.world, false, m.world.user.username, m.role === "coDM"));
  res.json([...ownedSummaries, ...sharedSummaries]);
});

worldsRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.world.findFirst({
    where: { id: req.params.id, OR: [{ userId: req.userId }, { id: { in: memberWorldIds } }] },
  });
  if (!row) return res.status(404).json({ error: "World not found" });
  res.json({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    nextSessionAt: row.nextSessionAt?.toISOString(),
    currentDay: row.currentDay,
    houseRules: coerceHouseRules(JSON.parse(row.houseRules)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

worldsRouter.post("/", async (req, res) => {
  const { name, description } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "World name is required" });

  // requireAuth doesn't attach tier (it's a pure JWT check with no DB hit,
  // and we don't want to add one to every authenticated request) — so this
  // is the one route that looks it up, only when a cap decision needs it.
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { tier: true } });
  if (user?.tier !== "paid") {
    const worldCount = await prisma.world.count({ where: { userId: req.userId } });
    if (worldCount >= FREE_TIER_WORLD_LIMIT) {
      return res.status(403).json({ error: `Free accounts are limited to ${FREE_TIER_WORLD_LIMIT} worlds — upgrade to create more.`, code: "world_limit" });
    }
  }

  const row = await prisma.world.create({ data: { name, description: description ?? null, userId: req.userId! } });
  res.status(201).json({ ...row, houseRules: coerceHouseRules(JSON.parse(row.houseRules)) });
});

// Gated to accounts with zero worlds so it can't be spammed to create
// infinite sample worlds — once it's used, "Load a Sample World" is no
// longer relevant to that account.
worldsRouter.post("/starter", async (req, res) => {
  const existingCount = await prisma.world.count({ where: { userId: req.userId } });
  if (existingCount > 0) {
    return res.status(409).json({ error: "You already have worlds — the sample world is only for brand-new accounts" });
  }
  const { worldId } = await seedStarterWorld(req.userId!);
  res.status(201).json({ worldId });
});

worldsRouter.patch("/:id", async (req, res) => {
  const { name, description, nextSessionAt, currentDay, houseRules } = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (nextSessionAt !== undefined) {
    if (nextSessionAt === null) {
      data.nextSessionAt = null;
    } else {
      const parsed = new Date(nextSessionAt);
      if (Number.isNaN(parsed.getTime())) return res.status(400).json({ error: "nextSessionAt is not a valid date" });
      data.nextSessionAt = parsed;
    }
  }
  if (currentDay !== undefined) {
    if (typeof currentDay !== "number" || !Number.isInteger(currentDay) || currentDay < 1) {
      return res.status(400).json({ error: "currentDay must be a positive integer" });
    }
    data.currentDay = currentDay;
  }
  if (houseRules !== undefined) data.houseRules = JSON.stringify(coerceHouseRules(houseRules));

  if (!(await canWriteWorld(req.userId!, req.params.id))) {
    return res.status(404).json({ error: "World not found" });
  }
  const row = await prisma.world.update({ where: { id: req.params.id }, data });
  res.json({ ...row, houseRules: coerceHouseRules(JSON.parse(row.houseRules)) });
});

// Owner or coDM: moves the in-world calendar forward by a DM-chosen number
// of days — never automatic (see World.currentDay's comment in
// shared/types.ts for why). Downtime/Travel only ever suggest a day count;
// this is the one place that actually advances it.
worldsRouter.post("/:id/advance-day", async (req, res) => {
  const days = req.body?.days;
  if (typeof days !== "number" || !Number.isInteger(days) || days < 1) {
    return res.status(400).json({ error: "days must be a positive integer" });
  }
  if (!(await canWriteWorld(req.userId!, req.params.id))) {
    return res.status(404).json({ error: "World not found" });
  }
  const row = await prisma.world.update({ where: { id: req.params.id }, data: { currentDay: { increment: days } } });
  res.json(row);
});

worldsRouter.delete("/:id", async (req, res) => {
  const result = await prisma.world.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "World not found" });
  res.status(204).end();
});

// Owner-only: (re)generate this world's join code. Returns the plaintext
// code once, same as the account recovery code — only the bcrypt hash is
// stored, and regenerating invalidates whatever code was issued before.
worldsRouter.post("/:id/join-code", async (req, res) => {
  const world = await prisma.world.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!world) return res.status(404).json({ error: "World not found" });
  const { role } = req.body ?? {};
  if (role !== undefined && !isWorldMemberRole(role)) return res.status(400).json({ error: "Invalid role" });
  const code = generateRecoveryCode();
  const joinCodeHash = await hashRecoveryCode(code);
  await prisma.world.update({
    where: { id: world.id },
    data: { joinCodeHash, joinCodeLookup: codeLookupDigest(code), joinCodeRole: role ?? "player" },
  });
  res.json({ code });
});

worldsRouter.post("/join", async (req, res) => {
  const { code } = req.body ?? {};
  if (!code || typeof code !== "string") return res.status(400).json({ error: "Join code is required" });

  // Straight to the one world whose code this is. The bcrypt hash still
  // does the verifying — the digest only says which row to check, so a
  // digest collision or a stale lookup value can't admit a wrong code.
  let matched = await prisma.world.findUnique({ where: { joinCodeLookup: codeLookupDigest(code) } });
  if (matched && !(matched.joinCodeHash && await verifyRecoveryCode(code, matched.joinCodeHash))) {
    matched = null;
  }

  // Codes issued before joinCodeLookup existed have no digest to find them
  // by, and can't be given one — the plaintext was never stored. Those rows
  // still need their codes to work, so they fall back to comparing against
  // each of them in turn. This set only shrinks: every reissued code gets a
  // lookup value, and nothing new ever lands here.
  if (!matched) {
    const legacy = await prisma.world.findMany({ where: { joinCodeHash: { not: null }, joinCodeLookup: null } });
    for (const candidate of legacy) {
      if (candidate.joinCodeHash && (await verifyRecoveryCode(code, candidate.joinCodeHash))) {
        matched = candidate;
        break;
      }
    }
  }
  if (!matched) return res.status(404).json({ error: "Invalid join code" });
  if (matched.userId === req.userId) return res.status(400).json({ error: "You already own this world" });

  await prisma.worldMember.upsert({
    where: { worldId_userId: { worldId: matched.id, userId: req.userId! } },
    create: { worldId: matched.id, userId: req.userId!, role: matched.joinCodeRole },
    update: {},
  });
  res.status(201).json({ worldId: matched.id, worldName: matched.name });
});

worldsRouter.get("/:id/members", async (req, res) => {
  const world = await prisma.world.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!world) return res.status(404).json({ error: "World not found" });
  const members = await prisma.worldMember.findMany({
    where: { worldId: req.params.id },
    include: { user: { select: { id: true, username: true } } },
  });
  res.json(members.map((m) => ({ userId: m.user.id, username: m.user.username, role: m.role })));
});

worldsRouter.patch("/:id/members/:userId", async (req, res) => {
  const world = await prisma.world.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!world) return res.status(404).json({ error: "World not found" });
  const { role } = req.body ?? {};
  if (!isWorldMemberRole(role)) return res.status(400).json({ error: "Invalid role" });
  const result = await prisma.worldMember.updateMany({ where: { worldId: req.params.id, userId: req.params.userId }, data: { role } });
  if (result.count === 0) return res.status(404).json({ error: "Member not found" });
  res.status(204).end();
});

worldsRouter.delete("/:id/members/:userId", async (req, res) => {
  const world = await prisma.world.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!world) return res.status(404).json({ error: "World not found" });
  await prisma.worldMember.deleteMany({ where: { worldId: req.params.id, userId: req.params.userId } });
  res.status(204).end();
});

worldsRouter.post("/:id/leave", async (req, res) => {
  const result = await prisma.worldMember.deleteMany({ where: { worldId: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "You are not a member of this world" });
  res.status(204).end();
});
