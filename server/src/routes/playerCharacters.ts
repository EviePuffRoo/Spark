import { Router } from "express";
import { prisma } from "../db.js";
import { toPlayerCharacterDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { findAccessibleWorld, getMemberWorldIds } from "../worldAccess.js";
import type { DeathSaves, SpellSlotLevel, ClassResource } from "@spark/shared";

function coerceDeathSaves(raw: unknown): DeathSaves {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    successes: typeof r.successes === "number" ? r.successes : 0,
    failures: typeof r.failures === "number" ? r.failures : 0,
  };
}

function coerceSpellSlots(raw: unknown): SpellSlotLevel[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => s && typeof s === "object")
    .map((s) => {
      const r = s as Record<string, unknown>;
      return {
        level: typeof r.level === "number" ? r.level : 0,
        max: typeof r.max === "number" ? r.max : 0,
        current: typeof r.current === "number" ? r.current : 0,
      };
    });
}

function coerceClassResources(raw: unknown): ClassResource[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => s && typeof s === "object")
    .map((s) => {
      const r = s as Record<string, unknown>;
      return {
        name: typeof r.name === "string" ? r.name : "",
        max: typeof r.max === "number" ? r.max : 0,
        current: typeof r.current === "number" ? r.current : 0,
        rechargeOn: r.rechargeOn === "short" ? "short" : "long",
      };
    });
}

export const playerCharactersRouter = Router();

playerCharactersRouter.get("/", async (req, res) => {
  const { worldId, mine } = req.query;

  if (mine === "true") {
    const rows = await prisma.playerCharacter.findMany({ where: { userId: req.userId }, orderBy: { createdAt: "desc" } });
    return res.json(rows.map(toPlayerCharacterDTO));
  }

  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = {
    OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }],
    ...(worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.playerCharacter.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toPlayerCharacterDTO));
});

playerCharactersRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.playerCharacter.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
  if (!row) return res.status(404).json({ error: "Player character not found" });
  res.json(toPlayerCharacterDTO(row));
});

playerCharactersRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { name, className, level, race, armorClass, maxHp, abilityScores, playerName, worldId, tags, notes, hiddenFromParty } = body;

  if (!name || !className || !level || !race || !armorClass || !maxHp) {
    return res.status(400).json({ error: "Missing required player character fields" });
  }
  if (typeof worldId === "string") {
    const world = await findAccessibleWorld(req.userId!, worldId);
    if (!world) return res.status(403).json({ error: "You don't have access to this world" });
  }

  const row = await prisma.playerCharacter.create({
    data: {
      name, className, level: Number(level), race, armorClass: Number(armorClass), maxHp: Number(maxHp),
      currentHp: Number(maxHp),
      abilityScores: JSON.stringify(abilityScores ?? {}),
      playerName: playerName ?? null,
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
      spellSlots: JSON.stringify(coerceSpellSlots(body.spellSlots)),
      classResources: JSON.stringify(coerceClassResources(body.classResources)),
      hiddenFromParty: !!hiddenFromParty,
      userId: req.userId!,
    },
  });
  res.status(201).json(toPlayerCharacterDTO(row));
});

playerCharactersRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["name", "className", "race", "playerName", "notes", "hiddenFromParty"] as const) {
    if (field in body) data[field] = body[field];
  }
  for (const field of ["level", "armorClass", "maxHp", "currentHp"] as const) {
    if (field in body) data[field] = Number(body[field]);
  }
  if ("abilityScores" in body) data.abilityScores = JSON.stringify(body.abilityScores ?? {});
  if ("worldId" in body) {
    if (typeof body.worldId === "string") {
      const world = await findAccessibleWorld(req.userId!, body.worldId);
      if (!world) return res.status(403).json({ error: "You don't have access to this world" });
    }
    data.worldId = body.worldId ?? null;
  }
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);
  if ("deathSaves" in body) data.deathSaves = JSON.stringify(coerceDeathSaves(body.deathSaves));
  if ("spellSlots" in body) data.spellSlots = JSON.stringify(coerceSpellSlots(body.spellSlots));
  if ("preparedSpells" in body) data.preparedSpells = JSON.stringify(Array.isArray(body.preparedSpells) ? body.preparedSpells.filter((s: unknown) => typeof s === "string") : []);
  if ("classResources" in body) data.classResources = JSON.stringify(coerceClassResources(body.classResources));
  if ("conditions" in body) data.conditions = JSON.stringify(Array.isArray(body.conditions) ? body.conditions.filter((s: unknown) => typeof s === "string") : []);

  if ("equippedItems" in body || "attunedItems" in body) {
    const equipped: string[] = Array.isArray(body.equippedItems) ? body.equippedItems : [];
    const attuned: string[] = Array.isArray(body.attunedItems) ? body.attunedItems : [];
    if (attuned.length > 3 || attuned.some((id) => !equipped.includes(id))) {
      return res.status(400).json({ error: "Attunement is limited to 3 items, and only equipped items can be attuned" });
    }
    data.equippedItems = JSON.stringify(equipped);
    data.attunedItems = JSON.stringify(attuned);
  }

  const result = await prisma.playerCharacter.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ error: "Player character not found" });
  const row = await prisma.playerCharacter.findUnique({ where: { id: req.params.id } });
  res.json(toPlayerCharacterDTO(row!));
});

// Hands a player character to a different account — e.g. a DM pre-rolled a
// PC before session zero and now wants the actual player's own login to own
// (and be able to edit/rest/track) it, instead of it staying stuck under
// whoever originally generated it. Only the world's owner can do this, and
// only to another member of that same world (or back to themselves).
playerCharactersRouter.patch("/:id/owner", async (req, res) => {
  const { userId: targetUserId } = req.body ?? {};
  if (typeof targetUserId !== "string" || !targetUserId) {
    return res.status(400).json({ error: "A target user is required." });
  }

  const pc = await prisma.playerCharacter.findUnique({ where: { id: req.params.id } });
  if (!pc || !pc.worldId) return res.status(404).json({ error: "Player character not found" });

  const world = await prisma.world.findUnique({ where: { id: pc.worldId } });
  if (!world || world.userId !== req.userId) {
    return res.status(403).json({ error: "Only the world's owner can reassign a player character." });
  }

  if (targetUserId !== world.userId) {
    const membership = await prisma.worldMember.findUnique({ where: { worldId_userId: { worldId: world.id, userId: targetUserId } } });
    if (!membership) return res.status(400).json({ error: "That user isn't a member of this world." });
  }

  const row = await prisma.playerCharacter.update({ where: { id: pc.id }, data: { userId: targetUserId } });
  res.json(toPlayerCharacterDTO(row));
});

playerCharactersRouter.post("/:id/rest", async (req, res) => {
  const kind = req.body?.kind === "short" ? "short" : "long";
  const row = await prisma.playerCharacter.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!row) return res.status(404).json({ error: "Player character not found" });

  const spellSlots = coerceSpellSlots(JSON.parse(row.spellSlots)).map((s) => (kind === "long" ? { ...s, current: s.max } : s));
  // Long rest refills everything; short rest only refills resources flagged for it.
  const classResources = coerceClassResources(JSON.parse(row.classResources)).map((r) =>
    kind === "long" || r.rechargeOn === "short" ? { ...r, current: r.max } : r,
  );

  const data: Record<string, unknown> = { spellSlots: JSON.stringify(spellSlots), classResources: JSON.stringify(classResources) };
  if (kind === "long") {
    data.currentHp = row.maxHp;
    data.deathSaves = JSON.stringify({ successes: 0, failures: 0 });
    data.conditions = JSON.stringify([]);
  }

  await prisma.playerCharacter.update({ where: { id: row.id }, data });
  const updated = await prisma.playerCharacter.findUnique({ where: { id: row.id } });
  res.json(toPlayerCharacterDTO(updated!));
});

playerCharactersRouter.delete("/:id", async (req, res) => {
  const result = await prisma.playerCharacter.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Player character not found" });
  await deleteLinksForEntity("playerCharacter", req.params.id, req.userId!);
  res.status(204).end();
});
