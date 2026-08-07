import { Router } from "express";
import { prisma } from "../db.js";
import { toEncounterDTO } from "../serialize.js";
import { getMemberWorldIds } from "../worldAccess.js";
import type { LiveCombatant, CombatantKind, EncounterZone, EncounterZoneEffect, ZoneHazard } from "@spark/shared";

export const encountersRouter = Router();

async function findAccessibleWorld(userId: string, worldId: string) {
  const memberWorldIds = await getMemberWorldIds(userId);
  return prisma.world.findFirst({ where: { id: worldId, OR: [{ userId }, { id: { in: memberWorldIds } }] } });
}

function coerceCombatant(raw: unknown): LiveCombatant | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.id !== "string" || typeof c.name !== "string") return null;
  const kind: CombatantKind = c.kind === "monster" || c.kind === "playerCharacter" ? c.kind : "custom";
  return {
    id: c.id,
    name: c.name,
    kind,
    initiative: Number(c.initiative) || 0,
    maxHp: typeof c.maxHp === "number" ? c.maxHp : undefined,
    currentHp: typeof c.currentHp === "number" ? c.currentHp : undefined,
    hpStatus: "healthy", // recomputed server-side on every read, this value is discarded
    armorClass: typeof c.armorClass === "number" ? c.armorClass : undefined,
    conditions: Array.isArray(c.conditions) ? c.conditions.filter((x): x is string => typeof x === "string") : [],
    notes: typeof c.notes === "string" ? c.notes : "",
    hpVisible: c.hpVisible !== false,
    xp: typeof c.xp === "number" ? c.xp : undefined,
    level: typeof c.level === "number" ? c.level : undefined,
    zoneId: typeof c.zoneId === "string" ? c.zoneId : undefined,
    hidden: c.hidden === true,
  };
}

function coerceHazard(raw: unknown): ZoneHazard | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const h = raw as Record<string, unknown>;
  if (typeof h.label !== "string" || typeof h.damage !== "number") return undefined;
  return { label: h.label, damage: h.damage };
}

export function coerceZone(raw: unknown): EncounterZone | null {
  if (!raw || typeof raw !== "object") return null;
  const z = raw as Record<string, unknown>;
  if (typeof z.id !== "string" || typeof z.name !== "string") return null;
  return {
    id: z.id,
    name: z.name,
    tags: Array.isArray(z.tags) ? z.tags.filter((x): x is string => typeof x === "string") : [],
    x: typeof z.x === "number" ? z.x : 0,
    y: typeof z.y === "number" ? z.y : 0,
    connections: Array.isArray(z.connections) ? z.connections.filter((x): x is string => typeof x === "string") : [],
    revealed: z.revealed !== false,
    locationId: typeof z.locationId === "string" ? z.locationId : undefined,
    hazard: coerceHazard(z.hazard),
  };
}

function coerceZoneEffect(raw: unknown): EncounterZoneEffect | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.id !== "string" || typeof e.zoneId !== "string" || typeof e.label !== "string") return null;
  return {
    id: e.id,
    zoneId: e.zoneId,
    label: e.label,
    expiresAtRound: typeof e.expiresAtRound === "number" ? e.expiresAtRound : 0,
  };
}

encountersRouter.get("/:worldId", async (req, res) => {
  const { worldId } = req.params;
  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const row = await prisma.encounter.findUnique({ where: { worldId } });
  if (!row) {
    return res.json({ worldId, combatants: [], round: 1, turnIndex: 0, zones: [], zoneEffects: [], updatedAt: null });
  }
  res.json(toEncounterDTO(row, req.userId!, world.userId));
});

encountersRouter.put("/:worldId", async (req, res) => {
  const { worldId } = req.params;
  const world = await prisma.world.findFirst({ where: { id: worldId, userId: req.userId } });
  if (!world) return res.status(403).json({ error: "Only the world's owner can update its encounter" });

  const body = req.body ?? {};
  if (!Array.isArray(body.combatants)) {
    return res.status(400).json({ error: "combatants must be an array" });
  }
  const combatants = body.combatants.map(coerceCombatant).filter((c: LiveCombatant | null): c is LiveCombatant => c !== null);
  const zones = Array.isArray(body.zones) ? body.zones.map(coerceZone).filter((z: EncounterZone | null): z is EncounterZone => z !== null) : [];
  const zoneEffects = Array.isArray(body.zoneEffects) ? body.zoneEffects.map(coerceZoneEffect).filter((e: EncounterZoneEffect | null): e is EncounterZoneEffect => e !== null) : [];

  const row = await prisma.encounter.upsert({
    where: { worldId },
    create: {
      worldId,
      combatants: JSON.stringify(combatants),
      round: Number(body.round) || 1,
      turnIndex: Number(body.turnIndex) || 0,
      zones: JSON.stringify(zones),
      zoneEffects: JSON.stringify(zoneEffects),
    },
    update: {
      combatants: JSON.stringify(combatants),
      round: Number(body.round) || 1,
      turnIndex: Number(body.turnIndex) || 0,
      zones: JSON.stringify(zones),
      zoneEffects: JSON.stringify(zoneEffects),
    },
  });
  res.json(toEncounterDTO(row, req.userId!, world.userId));
});

// Narrow write path open to any party member (not owner-only like PUT
// above): can only nudge one combatant's currentHp by a caller-supplied
// delta, nothing else about the encounter. This is what lets a player
// apply their own roll's result to a monster's HP without granting them
// general write access to turn order, conditions, or the roster.
encountersRouter.post("/:worldId/adjust-hp", async (req, res) => {
  const { worldId } = req.params;
  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const { combatantId, delta } = req.body ?? {};
  if (typeof combatantId !== "string" || typeof delta !== "number") {
    return res.status(400).json({ error: "combatantId and delta are required" });
  }

  const row = await prisma.encounter.findUnique({ where: { worldId } });
  if (!row) return res.status(404).json({ error: "No active encounter for this world" });

  const combatants: LiveCombatant[] = JSON.parse(row.combatants);
  const target = combatants.find((c) => c.id === combatantId);
  if (!target) return res.status(404).json({ error: "Combatant not found" });

  const maxHp = target.maxHp ?? 0;
  target.currentHp = Math.max(0, Math.min(maxHp, (target.currentHp ?? 0) + delta));

  const updated = await prisma.encounter.update({
    where: { worldId },
    data: { combatants: JSON.stringify(combatants) },
  });
  res.json(toEncounterDTO(updated, req.userId!, world.userId));
});

// Narrow write path open to any party member: moves one combatant to a
// different zone, nothing else. Mirrors adjust-hp's permission model —
// there's no per-combatant "ownership" concept in this app, so any
// member can move any combatant (same trust model already established
// for HP). Non-owners are still blocked from moving into a zone they
// can't perceive (revealed: false), and from jumping to a non-adjacent
// zone once a combatant is already placed.
encountersRouter.post("/:worldId/move-zone", async (req, res) => {
  const { worldId } = req.params;
  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });
  const isOwner = world.userId === req.userId;

  const { combatantId, zoneId } = req.body ?? {};
  if (typeof combatantId !== "string" || typeof zoneId !== "string") {
    return res.status(400).json({ error: "combatantId and zoneId are required" });
  }

  const row = await prisma.encounter.findUnique({ where: { worldId } });
  if (!row) return res.status(404).json({ error: "No active encounter for this world" });

  const zones: EncounterZone[] = JSON.parse(row.zones);
  const targetZone = zones.find((z) => z.id === zoneId);
  if (!targetZone) return res.status(404).json({ error: "Zone not found" });
  if (!isOwner && !targetZone.revealed) {
    return res.status(403).json({ error: "That zone hasn't been revealed yet" });
  }

  const combatants: LiveCombatant[] = JSON.parse(row.combatants);
  const target = combatants.find((c) => c.id === combatantId);
  if (!target) return res.status(404).json({ error: "Combatant not found" });

  if (target.zoneId) {
    const currentZone = zones.find((z) => z.id === target.zoneId);
    const adjacent = (currentZone?.connections.includes(zoneId) ?? false) || targetZone.connections.includes(target.zoneId);
    if (!adjacent) return res.status(400).json({ error: "That zone isn't adjacent" });
  }

  target.zoneId = zoneId;
  const updated = await prisma.encounter.update({
    where: { worldId },
    data: { combatants: JSON.stringify(combatants) },
  });
  res.json(toEncounterDTO(updated, req.userId!, world.userId));
});
