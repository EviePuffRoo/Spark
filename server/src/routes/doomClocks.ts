import { Router } from "express";
import { prisma } from "../db.js";
import { toDoomClockDTO } from "../serialize.js";
import { findAccessibleWorld, canWriteWorld, authorizeEntityWrite, worldOwnerIsPaid } from "../worldAccess.js";
import { publishWorldChange } from "../worldEvents.js";

export const doomClocksRouter = Router();

// Owner sees every clock in the world; anyone else with standing access
// (a joined party member) sees only the ones the DM has marked
// visibleToParty — same "DM decides what's revealed" pattern hidden
// factions/zones already use.
doomClocksRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  if (typeof worldId !== "string") return res.status(400).json({ error: "worldId is required" });

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const where = world.userId === req.userId ? { worldId } : { worldId, visibleToParty: true };
  const rows = await prisma.doomClock.findMany({ where, orderBy: { createdAt: "asc" } });
  res.json(rows.map(toDoomClockDTO));
});

doomClocksRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { worldId, label, segments, visibleToParty } = body;

  if (
    typeof worldId !== "string" ||
    typeof label !== "string" || !label.trim() ||
    typeof segments !== "number" || !Number.isInteger(segments) || segments < 2 || segments > 20
  ) {
    return res.status(400).json({ error: "worldId, a label, and a segment count (2-20) are required" });
  }

  const world = await prisma.world.findUnique({ where: { id: worldId } });
  if (!world || !(await canWriteWorld(req.userId!, worldId))) {
    return res.status(403).json({ error: "You don't have write access to this world" });
  }
  if (!(await worldOwnerIsPaid(world.userId))) {
    return res.status(403).json({ error: "Doom Clocks are a paid feature — upgrade to create more.", code: "doom_clock_paid_only" });
  }

  const row = await prisma.doomClock.create({
    data: { worldId, label: label.trim(), segments, visibleToParty: !!visibleToParty, userId: req.userId! },
  });
  publishWorldChange(worldId, "doomClock");
  res.status(201).json(toDoomClockDTO(row));
});

doomClocksRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const existing = await prisma.doomClock.findUnique({ where: { id: req.params.id } });
  if (!existing || !(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Doom clock not found" });
  }

  const data: Record<string, unknown> = {};
  if ("label" in body) {
    if (typeof body.label !== "string" || !body.label.trim()) return res.status(400).json({ error: "label must be a non-empty string" });
    data.label = body.label.trim();
  }
  if ("segments" in body) {
    if (typeof body.segments !== "number" || !Number.isInteger(body.segments) || body.segments < 2 || body.segments > 20) {
      return res.status(400).json({ error: "segments must be an integer between 2 and 20" });
    }
    data.segments = body.segments;
    // Shrinking segments below the current fill clamps fill down with it,
    // in the same single write — never left inconsistent even briefly.
    if (body.segments < existing.filled) data.filled = body.segments;
  }
  if ("visibleToParty" in body) data.visibleToParty = !!body.visibleToParty;

  const row = await prisma.doomClock.update({ where: { id: existing.id }, data });
  publishWorldChange(existing.worldId, "doomClock");
  res.json(toDoomClockDTO(row));
});

doomClocksRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.doomClock.findUnique({ where: { id: req.params.id } });
  if (!existing || !(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Doom clock not found" });
  }
  await prisma.doomClock.delete({ where: { id: req.params.id } });
  publishWorldChange(existing.worldId, "doomClock");
  res.status(204).end();
});

// Advance and reset are separate "smart" actions (rather than a raw PATCH
// of `filled`) so the clamp to [0, segments] always happens server-side —
// same convenience-endpoint-over-raw-PATCH shape as adjust-reputation.
doomClocksRouter.post("/:id/advance", async (req, res) => {
  const amount = typeof req.body?.amount === "number" ? Math.trunc(req.body.amount) : 1;
  const row = await prisma.doomClock.findUnique({ where: { id: req.params.id } });
  if (!row || !(await authorizeEntityWrite(req.userId!, row))) {
    return res.status(404).json({ error: "Doom clock not found" });
  }

  const filled = Math.max(0, Math.min(row.segments, row.filled + amount));
  const updated = await prisma.doomClock.update({ where: { id: row.id }, data: { filled } });
  publishWorldChange(row.worldId, "doomClock");
  res.json(toDoomClockDTO(updated));
});

doomClocksRouter.post("/:id/reset", async (req, res) => {
  const existing = await prisma.doomClock.findUnique({ where: { id: req.params.id } });
  if (!existing || !(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Doom clock not found" });
  }
  const row = await prisma.doomClock.update({ where: { id: req.params.id }, data: { filled: 0 } });
  publishWorldChange(existing.worldId, "doomClock");
  res.json(toDoomClockDTO(row));
});
