import { Router } from "express";
import { prisma } from "../db.js";
import { findAccessibleWorld } from "../worldAccess.js";
import type { SessionHighlights, SessionHighlightRoll } from "@spark/shared";

export const sessionHighlightsRouter = Router();

// A "natural" d20 result only means anything for a single, unmodified d20
// roll (a check/save/attack) — matches notation like "1d20" or "1d20+5",
// never a multi-die or non-d20 roll. The modifier lives separately from
// `results` (the raw die faces), so results[0] is always the unmodified
// face for this shape.
const SINGLE_D20_NOTATION = /^1d20([+-]\d+)?$/i;

function toHighlightRoll(row: { rollerName: string; notation: string; total: number; label: string | null; createdAt: Date }): SessionHighlightRoll {
  return { rollerName: row.rollerName, notation: row.notation, total: row.total, label: row.label, createdAt: row.createdAt.toISOString() };
}

sessionHighlightsRouter.get("/", async (req, res) => {
  const { worldId, since } = req.query;
  if (typeof worldId !== "string" || typeof since !== "string" || Number.isNaN(Date.parse(since))) {
    return res.status(400).json({ error: "worldId and a valid since timestamp are required" });
  }

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const isOwner = world.userId === req.userId;
  const sinceDate = new Date(since);
  const rollWhere = { worldId, createdAt: { gte: sinceDate }, ...(isOwner ? {} : { hiddenFromParty: false }) };

  // Same visibility rule as the roll/chat queries above — a quest a DM
  // marked hidden from the party shouldn't show up in a recap a player
  // can see.
  const questWhere = { worldId, status: "completed", updatedAt: { gte: sinceDate }, ...(isOwner ? {} : { hiddenFromParty: false }) };

  const [rolls, rollCount, messageCount, goldAgg, itemGroups, completedQuests] = await Promise.all([
    // Every roll in the period, in memory, since nat-20/nat-1 detection
    // needs the notation shape check below rather than a DB-level filter.
    prisma.rollLogEntry.findMany({ where: rollWhere, orderBy: { createdAt: "desc" } }),
    prisma.rollLogEntry.count({ where: rollWhere }),
    prisma.chatMessage.count({ where: { worldId, createdAt: { gte: sinceDate } } }),
    prisma.ledgerEntry.aggregate({ where: { worldId, kind: "gold", createdAt: { gte: sinceDate } }, _sum: { amount: true } }),
    prisma.ledgerEntry.groupBy({ by: ["label"], where: { worldId, kind: "item", createdAt: { gte: sinceDate } }, _sum: { amount: true } }),
    // A quest's status flipping to "completed" is the closest signal we
    // have to "finished this session" — not perfectly precise (editing
    // another field after completion also bumps updatedAt), but the same
    // best-effort spirit as the rest of this endpoint.
    prisma.questHook.findMany({ where: questWhere, select: { title: true }, orderBy: { updatedAt: "desc" } }),
  ]);

  const naturalTwenties: SessionHighlightRoll[] = [];
  const naturalOnes: SessionHighlightRoll[] = [];
  for (const row of rolls) {
    if (!SINGLE_D20_NOTATION.test(row.notation)) continue;
    const face = (JSON.parse(row.results) as number[])[0];
    if (face === 20) naturalTwenties.push(toHighlightRoll(row));
    else if (face === 1) naturalOnes.push(toHighlightRoll(row));
  }

  const topRolls = [...rolls].sort((a, b) => b.total - a.total).slice(0, 3).map(toHighlightRoll);

  const itemsGained = itemGroups
    .map((g) => ({ label: g.label, quantity: g._sum.amount ?? 0 }))
    .filter((i) => i.quantity > 0)
    .sort((a, b) => a.label.localeCompare(b.label));

  const rollCountByRoller = new Map<string, number>();
  for (const row of rolls) rollCountByRoller.set(row.rollerName, (rollCountByRoller.get(row.rollerName) ?? 0) + 1);
  let mostActiveRoller: SessionHighlights["mostActiveRoller"] = null;
  for (const [rollerName, count] of rollCountByRoller) {
    if (!mostActiveRoller || count > mostActiveRoller.rollCount) mostActiveRoller = { rollerName, rollCount: count };
  }

  const highlights: SessionHighlights = {
    worldId,
    since: sinceDate.toISOString(),
    rollCount,
    messageCount,
    naturalTwenties,
    naturalOnes,
    topRolls,
    goldDelta: goldAgg._sum.amount ?? 0,
    itemsGained,
    mostActiveRoller,
    questsCompleted: completedQuests,
  };
  res.json(highlights);
});
