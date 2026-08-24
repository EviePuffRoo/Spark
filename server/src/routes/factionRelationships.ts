import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { toFactionRelationshipDTO, toCampaignEventDTO } from "../serialize.js";
import { findAccessibleWorld, getMemberWorldIds } from "../worldAccess.js";
import { FACTION_RELATIONSHIP_STANCES, resolveFactionBattle } from "@spark/shared";
import type { StatBlock, FactionBattleSideInput, FactionBattleProposal } from "@spark/shared";

export const factionRelationshipsRouter = Router();

// Builds one side of a battle from a faction's affiliated, still-active
// roster — every kind counts (an NPC captain matters as much as a
// "monster"-kind soldier), weighted by the same statBlock.xp each
// character was generated or hand-entered with, so battle strength never
// needs a second, parallel power system.
async function loadBattleSide(userId: string, factionId: string, factionName: string): Promise<FactionBattleSideInput> {
  const characters = await prisma.character.findMany({
    where: { factionId, userId, status: "active" },
    select: { id: true, name: true, statBlock: true },
  });
  return {
    factionId,
    factionName,
    combatants: characters.map((c) => ({
      id: c.id,
      name: c.name,
      power: (JSON.parse(c.statBlock) as StatBlock).xp ?? 0,
    })),
  };
}

// Shared by both the preview and apply routes so the two can never
// compute a different result for the same relationship/day — apply always
// recomputes rather than trusting a client-supplied proposal, since the
// computation is cheap, fully deterministic, and this way there's nothing
// for a stale or tampered client payload to lie about.
async function computeBattleProposal(userId: string, relationshipId: string): Promise<FactionBattleProposal | null> {
  const relationship = await prisma.factionRelationship.findFirst({ where: { id: relationshipId, userId } });
  if (!relationship) return null;
  const world = await prisma.world.findUnique({ where: { id: relationship.worldId } });
  if (!world) return null;
  const [factionA, factionB] = await Promise.all([
    prisma.faction.findUnique({ where: { id: relationship.factionAId } }),
    prisma.faction.findUnique({ where: { id: relationship.factionBId } }),
  ]);
  if (!factionA || !factionB) return null;

  const [sideA, sideB] = await Promise.all([
    loadBattleSide(userId, factionA.id, factionA.name),
    loadBattleSide(userId, factionB.id, factionB.name),
  ]);

  return resolveFactionBattle({ worldId: world.id, relationshipId, day: world.currentDay, sideA, sideB });
}

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

// Owner-only, computes but never writes — same "Simulate" trust model as
// World Tick's own proposal endpoint. Safe to re-fetch: identical until
// either faction's affiliated roster changes or the world's day advances.
factionRelationshipsRouter.get("/:id/simulate-battle", async (req, res) => {
  const proposal = await computeBattleProposal(req.userId!, req.params.id);
  if (!proposal) return res.status(404).json({ error: "Faction relationship not found" });
  res.json(proposal);
});

// Recomputes the same deterministic proposal (never trusts a client-sent
// one — see computeBattleProposal) and writes it through: casualty
// characters get their status flipped, both factions get a reputation
// delta plus an audit-log entry via the same transaction shape the manual
// adjust-reputation endpoint uses, and one CampaignEvent narrates the
// battle. The relationship's stance is left untouched — the DM decides
// if/when a war is actually over.
factionRelationshipsRouter.post("/:id/apply-battle", async (req, res) => {
  const proposal = await computeBattleProposal(req.userId!, req.params.id);
  if (!proposal) return res.status(404).json({ error: "Faction relationship not found" });

  const relationship = await prisma.factionRelationship.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!relationship) return res.status(404).json({ error: "Faction relationship not found" });

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  const authorName = user?.displayName || user?.username || "The DM";

  const ops: Prisma.PrismaPromise<unknown>[] = [
    ...proposal.casualties.map((c) =>
      prisma.character.update({ where: { id: c.characterId }, data: { status: c.outcome } }),
    ),
    ...proposal.reputationDeltas.flatMap((d) => [
      prisma.faction.update({ where: { id: d.factionId }, data: { reputation: { increment: d.delta } } }),
      prisma.factionLogEntry.create({
        data: { factionId: d.factionId, authorName, delta: d.delta, reason: proposal.title, userId: req.userId! },
      }),
    ]),
    prisma.campaignEvent.create({
      data: { worldId: relationship.worldId, title: proposal.title, description: proposal.narrative, factionId: proposal.winnerFactionId, userId: req.userId! },
    }),
  ];

  const results = await prisma.$transaction(ops);
  const eventRow = results[results.length - 1];
  res.status(201).json({ proposal, event: toCampaignEventDTO(eventRow as Parameters<typeof toCampaignEventDTO>[0]) });
});
