import { Router } from "express";
import { prisma } from "../db.js";
import { findAccessibleWorld } from "../worldAccess.js";
import { ACHIEVEMENTS } from "@spark/shared";
import type { AchievementProgress, WorldAchievements } from "@spark/shared";

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

achievementsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  if (typeof worldId !== "string") return res.status(400).json({ error: "worldId is required" });

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

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

  const CURRENT: Record<string, number> = {
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

  const progress: AchievementProgress[] = ACHIEVEMENTS.map((def) => {
    const target = def.target ?? 1;
    const current = CURRENT[def.id] ?? 0;
    return { id: def.id, unlocked: current >= target, current: Math.min(current, target), target };
  });

  const result: WorldAchievements = {
    worldId,
    unlockedCount: progress.filter((p) => p.unlocked).length,
    totalCount: progress.length,
    progress,
  };
  res.json(result);
});
