import { Router } from "express";
import { prisma } from "../db.js";
import { toRollLogEntryDTO } from "../serialize.js";
import { findAccessibleWorld } from "../worldAccess.js";
import { publishWorldChange } from "../worldEvents.js";
import { RECENT_HISTORY_LIMIT } from "@spark/shared";

export const rollLogRouter = Router();

rollLogRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  if (typeof worldId !== "string") return res.status(400).json({ error: "worldId is required" });

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const isOwner = world.userId === req.userId;
  const rows = await prisma.rollLogEntry.findMany({
    where: { worldId, ...(isOwner ? {} : { hiddenFromParty: false }) },
    orderBy: { createdAt: "desc" },
    take: RECENT_HISTORY_LIMIT,
  });
  res.json(rows.map(toRollLogEntryDTO));
});

// Paid-only: paging back further than the live view's most-recent window.
// Never touched by the live SSE channel (worldLive.ts) — that always
// re-sends the same top-RECENT_HISTORY_LIMIT window, so merging paginated
// results into the same client state would get wiped by the next live
// update. The client keeps this in a separate, on-demand section instead.
rollLogRouter.get("/history", async (req, res) => {
  const { worldId, before } = req.query;
  if (typeof worldId !== "string" || typeof before !== "string") {
    return res.status(400).json({ error: "worldId and before are required" });
  }

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { tier: true } });
  if (user?.tier !== "paid") {
    return res.status(403).json({ error: "Full history is a paid feature — upgrade to browse past this point.", code: "history_paid_only" });
  }

  const isOwner = world.userId === req.userId;
  const rows = await prisma.rollLogEntry.findMany({
    where: { worldId, ...(isOwner ? {} : { hiddenFromParty: false }) },
    orderBy: { createdAt: "desc" },
    cursor: { id: before },
    skip: 1,
    take: 50,
  });
  res.json(rows.map(toRollLogEntryDTO));
});

rollLogRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { worldId, rollerName, notation, results, modifier, total, mode, label, hiddenFromParty } = body;

  if (!worldId || !rollerName || !notation || !Array.isArray(results) || typeof total !== "number") {
    return res.status(400).json({ error: "Missing required roll log fields" });
  }

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const isOwner = world.userId === req.userId;
  const row = await prisma.rollLogEntry.create({
    data: {
      worldId,
      rollerName,
      notation,
      results: JSON.stringify(results),
      modifier: Number(modifier) || 0,
      total: Number(total),
      mode: mode === "adv" || mode === "dis" ? mode : null,
      label: label ?? null,
      hiddenFromParty: hiddenFromParty === true && isOwner,
      userId: req.userId!,
    },
  });
  publishWorldChange(worldId, "rollLog");
  res.status(201).json(toRollLogEntryDTO(row));
});

rollLogRouter.delete("/:id", async (req, res) => {
  const row = await prisma.rollLogEntry.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Roll not found" });

  const world = await prisma.world.findUnique({ where: { id: row.worldId } });
  const canDelete = row.userId === req.userId || world?.userId === req.userId;
  if (!canDelete) return res.status(403).json({ error: "You can't delete this roll" });

  await prisma.rollLogEntry.delete({ where: { id: req.params.id } });
  publishWorldChange(row.worldId, "rollLog");
  res.status(204).end();
});
