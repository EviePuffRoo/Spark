import { Router } from "express";
import { prisma } from "../db.js";
import { toFactionDTO, toFactionLogEntryDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { findAccessibleWorld, getMemberWorldIds } from "../worldAccess.js";
import { logCampaignEventOp } from "../campaignEventLog.js";

export const factionsRouter = Router();

factionsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = {
    OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }],
    ...(worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.faction.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toFactionDTO));
});

factionsRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.faction.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
  if (!row) return res.status(404).json({ error: "Faction not found" });
  res.json(toFactionDTO(row));
});

factionsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { name, factionType, agenda, methods, publicFace, hook, worldId, tags, notes, hiddenFromParty } = body;

  if (!name || !factionType || !agenda || !methods || !publicFace || !hook) {
    return res.status(400).json({ error: "Missing required faction fields" });
  }
  if (typeof worldId === "string") {
    const world = await findAccessibleWorld(req.userId!, worldId);
    if (!world) return res.status(403).json({ error: "You don't have access to this world" });
  }

  const row = await prisma.faction.create({
    data: {
      name, factionType, agenda, methods, publicFace, hook,
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
      hiddenFromParty: !!hiddenFromParty,
      userId: req.userId!,
    },
  });
  res.status(201).json(toFactionDTO(row));
});

factionsRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["name", "factionType", "agenda", "methods", "publicFace", "hook", "notes", "hiddenFromParty", "reputation"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("worldId" in body) {
    if (typeof body.worldId === "string") {
      const world = await findAccessibleWorld(req.userId!, body.worldId);
      if (!world) return res.status(403).json({ error: "You don't have access to this world" });
    }
    data.worldId = body.worldId ?? null;
  }
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  const result = await prisma.faction.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ error: "Faction not found" });
  const row = await prisma.faction.findUnique({ where: { id: req.params.id } });
  res.json(toFactionDTO(row!));
});

factionsRouter.delete("/:id", async (req, res) => {
  const result = await prisma.faction.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Faction not found" });
  await deleteLinksForEntity("faction", req.params.id, req.userId!);
  res.status(204).end();
});

// Applies a reputation change atomically and appends an audit-log entry —
// the "smart" convenience action layered over a raw PATCH of `reputation`,
// mirroring how Character's adjust-disposition endpoint is layered over
// its own plain PATCH.
factionsRouter.post("/:id/adjust-reputation", async (req, res) => {
  const delta = typeof req.body?.delta === "number" ? Math.trunc(req.body.delta) : NaN;
  const reason = typeof req.body?.reason === "string" && req.body.reason.trim() ? req.body.reason.trim() : undefined;
  if (!Number.isFinite(delta) || delta === 0) {
    return res.status(400).json({ error: "delta must be a nonzero number" });
  }

  const row = await prisma.faction.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!row) return res.status(404).json({ error: "Faction not found" });

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  const authorName = user?.displayName || user?.username || "The DM";

  const [updated] = await prisma.$transaction([
    prisma.faction.update({ where: { id: row.id }, data: { reputation: { increment: delta } } }),
    prisma.factionLogEntry.create({
      data: { factionId: row.id, authorName, delta, reason: reason ?? null, userId: req.userId! },
    }),
    logCampaignEventOp({
      worldId: row.worldId,
      entityType: "factionReputation",
      entityId: row.id,
      eventType: "faction.reputationChanged",
      payload: { factionId: row.id, factionName: row.name, delta, reason },
      authorName,
      userId: req.userId!,
    }),
  ]);
  res.json(toFactionDTO(updated));
});

factionsRouter.get("/:id/reputation-log", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.faction.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
  if (!row) return res.status(404).json({ error: "Faction not found" });

  const rows = await prisma.factionLogEntry.findMany({ where: { factionId: row.id }, orderBy: { createdAt: "desc" }, take: 100 });
  res.json(rows.map(toFactionLogEntryDTO));
});
