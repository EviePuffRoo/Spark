import { Router } from "express";
import { prisma } from "../db.js";
import { getMemberWorldIds } from "../worldAccess.js";
import type { ActivitySummary } from "@spark/shared";

export const activityRouter = Router();

activityRouter.get("/", async (req, res) => {
  const worldIds = await getMemberWorldIds(req.userId!);

  if (worldIds.length === 0) {
    const empty: ActivitySummary = { combatActivityAt: null, notesActivityAt: null, codexActivityAt: null, inventoryActivityAt: null };
    return res.json(empty);
  }

  const [latestRoll, latestEncounter, latestChat, latestNote, latestCodexNote, latestLedgerEntry] = await Promise.all([
    prisma.rollLogEntry.findFirst({ where: { worldId: { in: worldIds } }, orderBy: { createdAt: "desc" } }),
    prisma.encounter.findFirst({ where: { worldId: { in: worldIds } }, orderBy: { updatedAt: "desc" } }),
    prisma.chatMessage.findFirst({ where: { worldId: { in: worldIds } }, orderBy: { createdAt: "desc" } }),
    prisma.sessionNote.findFirst({ where: { worldId: { in: worldIds } }, orderBy: { createdAt: "desc" } }),
    prisma.codexNote.findFirst({ where: { worldId: { in: worldIds } }, orderBy: { createdAt: "desc" } }),
    prisma.ledgerEntry.findFirst({ where: { worldId: { in: worldIds } }, orderBy: { createdAt: "desc" } }),
  ]);

  // Chat lives on the same Combat page as the roll log, so new messages
  // light up the same "Combat" nav-badge dot rolls already do.
  const combatTimestamps = [latestRoll?.createdAt, latestEncounter?.updatedAt, latestChat?.createdAt].filter((d): d is Date => !!d);
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
