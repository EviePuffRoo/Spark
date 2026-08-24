import { Router } from "express";
import { prisma } from "../db.js";
import { toFactionRelationshipDTO } from "../serialize.js";
import { findAccessibleWorld, getMemberWorldIds } from "../worldAccess.js";
import { FACTION_RELATIONSHIP_STANCES } from "@spark/shared";

export const factionRelationshipsRouter = Router();

// Normalizes a faction pair to a stable order so there's never a duplicate
// row for the same two factions stored in opposite argument order.
function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

factionRelationshipsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  if (typeof worldId !== "string") return res.status(400).json({ error: "worldId is required" });

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const rows = await prisma.factionRelationship.findMany({ where: { worldId }, orderBy: { createdAt: "desc" } });

  if (world.userId === req.userId) {
    return res.json(rows.map(toFactionRelationshipDTO));
  }
  // A non-owner never sees a relationship touching a faction the DM has
  // hidden from the party — same spoiler concern GET /factions already
  // protects for the factions themselves; a relationship row would
  // otherwise reveal a hidden faction's existence, stance, and notes.
  const hiddenFactions = await prisma.faction.findMany({ where: { worldId, hiddenFromParty: true }, select: { id: true } });
  const hiddenIds = new Set(hiddenFactions.map((f) => f.id));
  const visible = rows.filter((r) => !hiddenIds.has(r.factionAId) && !hiddenIds.has(r.factionBId));
  res.json(visible.map(toFactionRelationshipDTO));
});

// Upserts the relationship for a faction pair: if one already exists it's
// updated in place (a DM changing an ally to a rival over time shouldn't
// pile up duplicate rows), otherwise a new one is created.
factionRelationshipsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { worldId, factionAId, factionBId, stance, notes } = body;

  if (
    typeof worldId !== "string" || typeof factionAId !== "string" || typeof factionBId !== "string" ||
    factionAId === factionBId ||
    typeof stance !== "string" || !(FACTION_RELATIONSHIP_STANCES as readonly string[]).includes(stance)
  ) {
    return res.status(400).json({ error: "worldId, two distinct faction ids, and a valid stance are required" });
  }

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const [factionA, factionB] = await Promise.all([
    prisma.faction.findFirst({ where: { id: factionAId, worldId, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } }),
    prisma.faction.findFirst({ where: { id: factionBId, worldId, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } }),
  ]);
  if (!factionA || !factionB) return res.status(404).json({ error: "Both factions must exist in this world" });

  const [normA, normB] = normalizePair(factionAId, factionBId);
  const row = await prisma.factionRelationship.upsert({
    where: { factionAId_factionBId: { factionAId: normA, factionBId: normB } },
    create: { worldId, factionAId: normA, factionBId: normB, stance, notes: notes ?? null, userId: req.userId! },
    update: { stance, notes: notes ?? null },
  });
  res.status(201).json(toFactionRelationshipDTO(row));
});

factionRelationshipsRouter.delete("/:id", async (req, res) => {
  const result = await prisma.factionRelationship.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Faction relationship not found" });
  res.status(204).end();
});
