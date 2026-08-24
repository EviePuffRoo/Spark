import { Router } from "express";
import { prisma } from "../db.js";
import { generateRecoveryCode, hashRecoveryCode, verifyRecoveryCode } from "../auth.js";
import { getMemberWorldIds } from "../worldAccess.js";
import { FREE_TIER_WORLD_LIMIT, type WorldMemberRole } from "@spark/shared";
import { seedStarterWorld } from "../seedStarterWorld.js";

export const worldsRouter = Router();

const WORLD_MEMBER_ROLES: WorldMemberRole[] = ["player", "coDM"];
function isWorldMemberRole(value: unknown): value is WorldMemberRole {
  return typeof value === "string" && (WORLD_MEMBER_ROLES as string[]).includes(value);
}

const COUNT_SELECT = {
  characters: true, items: true, locations: true, questHooks: true,
  factions: true, encounterTables: true, sessionNotes: true, adventures: true,
  playerCharacters: true,
};

function toSummary(
  row: { id: string; name: string; description: string | null; nextSessionAt: Date | null; currentDay: number; createdAt: Date; updatedAt: Date; _count: Record<string, number> },
  isOwner: boolean,
  ownerUsername?: string
) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    nextSessionAt: row.nextSessionAt?.toISOString(),
    currentDay: row.currentDay,
    isOwner,
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
  const sharedSummaries = memberships.map((m) => toSummary(m.world, false, m.world.user.username));
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
  res.status(201).json(row);
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
  const { name, description, nextSessionAt, currentDay } = req.body ?? {};
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

  const result = await prisma.world.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ error: "World not found" });
  const row = await prisma.world.findUnique({ where: { id: req.params.id } });
  res.json(row);
});

// Owner-only: moves the in-world calendar forward by a DM-chosen number of
// days — never automatic (see World.currentDay's comment in shared/types.ts
// for why). Downtime/Travel only ever suggest a day count; this is the one
// place that actually advances it.
worldsRouter.post("/:id/advance-day", async (req, res) => {
  const days = req.body?.days;
  if (typeof days !== "number" || !Number.isInteger(days) || days < 1) {
    return res.status(400).json({ error: "days must be a positive integer" });
  }
  const world = await prisma.world.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!world) return res.status(404).json({ error: "World not found" });
  const row = await prisma.world.update({ where: { id: world.id }, data: { currentDay: { increment: days } } });
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
  await prisma.world.update({ where: { id: world.id }, data: { joinCodeHash, joinCodeRole: role ?? "player" } });
  res.json({ code });
});

worldsRouter.post("/join", async (req, res) => {
  const { code } = req.body ?? {};
  if (!code || typeof code !== "string") return res.status(400).json({ error: "Join code is required" });

  const candidates = await prisma.world.findMany({ where: { joinCodeHash: { not: null } } });
  let matched: (typeof candidates)[number] | null = null;
  for (const candidate of candidates) {
    if (candidate.joinCodeHash && (await verifyRecoveryCode(code, candidate.joinCodeHash))) {
      matched = candidate;
      break;
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
