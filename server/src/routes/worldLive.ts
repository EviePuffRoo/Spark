import { Router, type Response } from "express";
import { prisma } from "../db.js";
import { toEncounterDTO, toLedgerEntryDTO, toRollLogEntryDTO, toChatMessageDTO } from "../serialize.js";
import { findAccessibleWorld } from "../worldAccess.js";
import { subscribeToWorld, type WorldChangeKind } from "../worldEvents.js";
import type { LedgerSummary } from "@spark/shared";

export const worldLiveRouter = Router();

const PING_INTERVAL_MS = 25000;

async function sendEncounter(res: Response, worldId: string, viewerId: string, worldOwnerId: string) {
  const row = await prisma.encounter.findUnique({ where: { worldId } });
  const dto = row
    ? toEncounterDTO(row, viewerId, worldOwnerId)
    : { worldId, combatants: [], round: 1, turnIndex: 0, zones: [], zoneEffects: [], updatedAt: null };
  res.write(`event: encounter\ndata: ${JSON.stringify(dto)}\n\n`);
}

async function sendLedger(res: Response, worldId: string) {
  const [goldAgg, itemGroups, entries] = await Promise.all([
    prisma.ledgerEntry.aggregate({ where: { worldId, kind: "gold" }, _sum: { amount: true } }),
    prisma.ledgerEntry.groupBy({ by: ["label"], where: { worldId, kind: "item" }, _sum: { amount: true } }),
    prisma.ledgerEntry.findMany({ where: { worldId }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const items = itemGroups
    .map((g) => ({ label: g.label, quantity: g._sum.amount ?? 0 }))
    .filter((i) => i.quantity > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
  const summary: LedgerSummary = {
    worldId,
    gold: goldAgg._sum.amount ?? 0,
    items,
    entries: entries.map(toLedgerEntryDTO),
  };
  res.write(`event: ledger\ndata: ${JSON.stringify(summary)}\n\n`);
}

async function sendRollLog(res: Response, worldId: string, isOwner: boolean) {
  const rows = await prisma.rollLogEntry.findMany({
    where: { worldId, ...(isOwner ? {} : { hiddenFromParty: false }) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.write(`event: rollLog\ndata: ${JSON.stringify(rows.map(toRollLogEntryDTO))}\n\n`);
}

async function sendChat(res: Response, worldId: string) {
  const rows = await prisma.chatMessage.findMany({
    where: { worldId },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  res.write(`event: chat\ndata: ${JSON.stringify(rows.map(toChatMessageDTO))}\n\n`);
}

// Multiplexed SSE channel for a world's live-updating data (encounter,
// ledger, roll log, chat). One connection, four possible `event:` names, so the
// client's EventSource can addEventListener per kind. Sits behind the
// existing global requireAuth gate (server/src/index.ts) — no auth changes,
// since EventSource sends cookies automatically on same-origin requests.
worldLiveRouter.get("/:worldId/live", async (req, res) => {
  const { worldId } = req.params;
  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const viewerId = req.userId!;
  const isOwner = world.userId === viewerId;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.write(":ok\n\n");

  const unsubscribe = subscribeToWorld(worldId, (kind: WorldChangeKind) => {
    if (kind === "encounter") sendEncounter(res, worldId, viewerId, world.userId).catch(() => {});
    else if (kind === "ledger") sendLedger(res, worldId).catch(() => {});
    else if (kind === "rollLog") sendRollLog(res, worldId, isOwner).catch(() => {});
    else if (kind === "chat") sendChat(res, worldId).catch(() => {});
  });

  const pingTimer = setInterval(() => res.write(":ping\n\n"), PING_INTERVAL_MS);

  req.on("close", () => {
    unsubscribe();
    clearInterval(pingTimer);
  });
});
