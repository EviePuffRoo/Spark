import { Router } from "express";
import { prisma } from "../db.js";
import { findAccessibleWorld, getMemberWorldIds } from "../worldAccess.js";
import { ACHIEVEMENTS } from "@spark/shared";
import type { AchievementProgress, WorldAchievements, LegacyAchievements } from "@spark/shared";

export const achievementsRouter = Router();

// Same shape a single, unmodified d20 roll can take — mirrors
// sessionHighlights.ts's identical check, since both need to tell a real
// natural 20/1 (the raw die face) apart from a modified total that just
// happens to equal 20 or 1.
const SINGLE_D20_NOTATION = /^1d20([+-]\d+)?$/i;

const ROSTER_COUNT_SELECT = {
  characters: true, items: true, locations: true, questHooks: true, factions: true,
  encounterTables: true, sessionNotes: true, adventures: true, playerCharacters: true,
} as const;

// Pulled out of the GET "/" handler so the legacy rollup below can run the
// exact same per-world computation for every world the account touches,
// rather than re-deriving a second version of these rules.
async function computeCurrentForWorld(worldId: string): Promise<Record<string, number>> {
  const [d20Rolls, totalRollCount, questsCompleted, goldEntries, goldEntryCount, sessionNoteCount, memberCount, chatCount, rosterWorld] = await Promise.all([
    // Narrowed at the DB level to plausible d20 notations before the
    // in-memory notation/results check — a long-running world's roll log
    // can get large, no reason to pull every non-d20 roll into memory too.
    prisma.rollLogEntry.findMany({ where: { worldId, notation: { startsWith: "1d20" } }, select: { notation: true, results: true } }),
    prisma.rollLogEntry.count({ where: { worldId } }),
    prisma.questHook.count({ where: { worldId, status: "completed" } }),
    prisma.ledgerEntry.findMany({ where: { worldId, kind: "gold" }, orderBy: { createdAt: "asc" }, select: { amount: true } }),
    prisma.ledgerEntry.count({ where: { worldId, kind: "gold" } }),
    prisma.sessionNote.count({ where: { worldId } }),
    prisma.worldMember.count({ where: { worldId } }),
    prisma.chatMessage.count({ where: { worldId } }),
    prisma.world.findUnique({ where: { id: worldId }, include: { _count: { select: ROSTER_COUNT_SELECT } } }),
  ]);

  let nat20Count = 0;
  let nat1Count = 0;
  for (const row of d20Rolls) {
    if (!SINGLE_D20_NOTATION.test(row.notation)) continue;
    const face = (JSON.parse(row.results) as number[])[0];
    if (face === 20) nat20Count++;
    else if (face === 1) nat1Count++;
  }

  let runningGold = 0;
  let peakGold = 0;
  for (const entry of goldEntries) {
    runningGold += entry.amount;
    if (runningGold > peakGold) peakGold = runningGold;
  }

  const rosterCount = rosterWorld
    ? Object.values(rosterWorld._count).reduce((sum, n) => sum + n, 0)
    : 0;
  // The owner never gets their own WorldMember row (see worldAccess.ts) —
  // so "everyone with standing access" is members plus the owner.
  const partySize = memberCount + 1;

  return {
    "first-blood": nat20Count,
    "hat-trick": nat20Count,
    "it-happens": nat1Count,
    "cursed": nat1Count,
    "warming-up": totalRollCount,
    "dice-goblin": totalRollCount,
    "quest-accepted": questsCompleted,
    "adventuring-company": questsCompleted,
    "legends-of-the-realm": questsCompleted,
    "first-coin": goldEntryCount,
    "comfortable": peakGold,
    "wealthy": peakGold,
    "filthy-rich": peakGold,
    "session-zero": sessionNoteCount,
    "regulars": sessionNoteCount,
    "the-long-campaign": sessionNoteCount,
    "full-table": partySize,
    "chatterbox": chatCount,
    "world-builder": rosterCount,
  };
}

function toProgress(current: Record<string, number>): AchievementProgress[] {
  return ACHIEVEMENTS.map((def) => {
    const target = def.target ?? 1;
    const value = current[def.id] ?? 0;
    return { id: def.id, unlocked: value >= target, current: Math.min(value, target), target };
  });
}

achievementsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  if (typeof worldId !== "string") return res.status(400).json({ error: "worldId is required" });

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const progress = toProgress(await computeCurrentForWorld(worldId));
  const result: WorldAchievements = {
    worldId,
    unlockedCount: progress.filter((p) => p.unlocked).length,
    totalCount: progress.length,
    progress,
  };
  res.json(result);
});

// Cross-campaign rollup: the same per-world stats summed across every
// world this account owns or has joined. No worldId — this is always the
// caller's own career, private by construction (there's no other user's
// legacy this endpoint could even be asked for).
achievementsRouter.get("/legacy", async (req, res) => {
  const worldIds = await getMemberWorldIds(req.userId!);
  const perWorldCurrent = await Promise.all(worldIds.map(computeCurrentForWorld));

  const summed: Record<string, number> = {};
  for (const current of perWorldCurrent) {
    for (const [id, value] of Object.entries(current)) {
      summed[id] = (summed[id] ?? 0) + value;
    }
  }

  const progress = toProgress(summed);
  const result: LegacyAchievements = {
    worldCount: worldIds.length,
    unlockedCount: progress.filter((p) => p.unlocked).length,
    totalCount: progress.length,
    progress,
  };
  res.json(result);
});
