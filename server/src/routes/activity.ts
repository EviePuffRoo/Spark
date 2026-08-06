import { Router } from "express";
import { prisma } from "../db.js";
import { getMemberWorldIds } from "../worldAccess.js";
import type { ActivitySummary } from "@spark/shared";

export const activityRouter = Router();

activityRouter.get("/", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const ownedWorlds = await prisma.world.findMany({ where: { userId: req.userId }, select: { id: true } });
  const worldIds = Array.from(new Set([...memberWorldIds, ...ownedWorlds.map((w) => w.id)]));

  if (worldIds.length === 0) {
    const empty: ActivitySummary = { combatActivityAt: null, notesActivityAt: null, codexActivityAt: null, inventoryActivityAt: null };
    return res.json(empty);
  }

  const [latestRoll, latestEncounter, latestNote, latestCodexNote, latestLedgerEntry] = await Promise.all([
    prisma.rollLogEntry.findFirst({ where: { worldId: { in: worldIds } }, orderBy: { createdAt: "desc" } }),
    prisma.encounter.findFirst({ where: { worldId: { in: worldIds } }, orderBy: { updatedAt: "desc" } }),
    prisma.sessionNote.findFirst({ where: { worldId: { in: worldIds } }, orderBy: { createdAt: "desc" } }),
    prisma.codexNote.findFirst({ where: { worldId: { in: worldIds } }, orderBy: { createdAt: "desc" } }),
    prisma.ledgerEntry.findFirst({ where: { worldId: { in: worldIds } }, orderBy: { createdAt: "desc" } }),
  ]);

  const combatTimestamps = [latestRoll?.createdAt, latestEncounter?.updatedAt].filter((d): d is Date => !!d);
  const combatActivityAt = combatTimestamps.length > 0
    ? new Date(Math.max(...combatTimestamps.map((d) => d.getTime()))).toISOString()
    : null;

  const summary: ActivitySummary = {
    combatActivityAt,
    notesActivityAt: latestNote ? latestNote.createdAt.toISOString() : null,
    codexActivityAt: latestCodexNote ? latestCodexNote.createdAt.toISOString() : null,
    inventoryActivityAt: latestLedgerEntry ? latestLedgerEntry.createdAt.toISOString() : null,
  };
  res.json(summary);
});
