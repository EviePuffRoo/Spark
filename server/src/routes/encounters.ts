import { Router } from "express";
import { prisma } from "../db.js";
import { toEncounterDTO } from "../serialize.js";
import { findAccessibleWorld } from "../worldAccess.js";
import { publishWorldChange } from "../worldEvents.js";
import type { LiveCombatant, LiveCombatantCondition, CombatantKind, EncounterZone, EncounterZoneEffect, ZoneHazard, ParsedAttack, AbilityKey, SizeCategory, PlacedTile } from "@spark/shared";
import { SIZE_FOOTPRINT, computeReachableCells } from "@spark/shared";

export const encountersRouter = Router();

// Serializes the write handlers below for a given worldId's encounter row.
// PUT, adjust-hp, and move-zone all round-trip the same `combatants` JSON
// blob (read the row, mutate it in JS, write the whole thing back), and a
// Prisma `$transaction` alone doesn't prevent two concurrent requests from
// interleaving here — SQLite via Prisma doesn't hold a write lock across
// the read, so both can read the same pre-mutation snapshot and each write
// back a version that silently drops the other's change. Since this app
// runs as a single Node process (no horizontal scaling), a plain in-memory
// per-world queue is enough to make each of these read-modify-write cycles
// atomic relative to one another.
const encounterLocks = new Map<string, Promise<unknown>>();
function withEncounterLock<T>(worldId: string, fn: () => Promise<T>): Promise<T> {
  const prior = encounterLocks.get(worldId) ?? Promise.resolve();
  const next = prior.then(fn, fn);
  encounterLocks.set(worldId, next.catch(() => {}));
  return next;
}

const ABILITY_KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const SIZE_CATEGORIES: SizeCategory[] = ["tiny", "small", "medium", "large", "huge", "gargantuan"];

// Conditions used to be a plain string[]; a raw string entry from an
// encounter saved before duration tracking existed is treated as an
// indefinite condition rather than dropped, so older saved encounters
// keep working without a migration.
function coerceCondition(raw: unknown): LiveCombatantCondition | null {
  if (typeof raw === "string") return raw ? { name: raw, expiresAtRound: null } : null;
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.name !== "string" || !c.name) return null;
  return { name: c.name, expiresAtRound: typeof c.expiresAtRound === "number" ? c.expiresAtRound : null };
}

function coerceAttack(raw: unknown): ParsedAttack | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  if (typeof a.name !== "string") return null;
  let savingThrow: ParsedAttack["savingThrow"] = null;
  if (a.savingThrow && typeof a.savingThrow === "object") {
    const s = a.savingThrow as Record<string, unknown>;
    if (ABILITY_KEYS.includes(s.ability as AbilityKey) && typeof s.dc === "number") {
      savingThrow = { ability: s.ability as AbilityKey, dc: s.dc };
    }
  }
  return {
    name: a.name,
    toHitBonus: typeof a.toHitBonus === "number" ? a.toHitBonus : null,
    damageDice: typeof a.damageDice === "string" ? a.damageDice : null,
    damageType: typeof a.damageType === "string" ? a.damageType : null,
    savingThrow,
  };
}

function coerceCombatant(raw: unknown): LiveCombatant | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.id !== "string" || typeof c.name !== "string") return null;
  const kind: CombatantKind = c.kind === "monster" || c.kind === "playerCharacter" ? c.kind : "custom";
  const attacks = Array.isArray(c.attacks) ? c.attacks.map(coerceAttack).filter((a): a is ParsedAttack => a !== null) : undefined;
  return {
    id: c.id,
    name: c.name,
    kind,
    initiative: Number(c.initiative) || 0,
    maxHp: typeof c.maxHp === "number" ? c.maxHp : undefined,
    currentHp: typeof c.currentHp === "number" ? c.currentHp : undefined,
    hpStatus: "healthy", // recomputed server-side on every read, this value is discarded
    armorClass: typeof c.armorClass === "number" ? c.armorClass : undefined,
    conditions: Array.isArray(c.conditions) ? c.conditions.map(coerceCondition).filter((x): x is LiveCombatantCondition => x !== null) : [],
    notes: typeof c.notes === "string" ? c.notes : "",
    hpVisible: c.hpVisible !== false,
    xp: typeof c.xp === "number" ? c.xp : undefined,
    level: typeof c.level === "number" ? c.level : undefined,
    zoneId: typeof c.zoneId === "string" ? c.zoneId : undefined,
    hidden: c.hidden === true,
    playerCharacterId: typeof c.playerCharacterId === "string" ? c.playerCharacterId : undefined,
    attacks: attacks && attacks.length > 0 ? attacks : undefined,
    gridX: typeof c.gridX === "number" ? c.gridX : undefined,
    gridY: typeof c.gridY === "number" ? c.gridY : undefined,
    sizeCategory: SIZE_CATEGORIES.includes(c.sizeCategory as SizeCategory) ? (c.sizeCategory as SizeCategory) : undefined,
    speedFeet: typeof c.speedFeet === "number" ? c.speedFeet : undefined,
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
  const activeDungeonId = typeof body.activeDungeonId === "string" ? body.activeDungeonId : null;
  const activeDungeonRoomId = typeof body.activeDungeonRoomId === "string" ? body.activeDungeonRoomId : null;
  const activeBattleMapId = typeof body.activeBattleMapId === "string" ? body.activeBattleMapId : null;

  const row = await withEncounterLock(worldId, () => prisma.encounter.upsert({
    where: { worldId },
    create: {
      worldId,
      combatants: JSON.stringify(combatants),
      round: Number(body.round) || 1,
      turnIndex: Number(body.turnIndex) || 0,
      zones: JSON.stringify(zones),
      zoneEffects: JSON.stringify(zoneEffects),
      activeDungeonId,
      activeDungeonRoomId,
      activeBattleMapId,
    },
    update: {
      combatants: JSON.stringify(combatants),
      round: Number(body.round) || 1,
      turnIndex: Number(body.turnIndex) || 0,
      zones: JSON.stringify(zones),
      zoneEffects: JSON.stringify(zoneEffects),
      activeDungeonId,
      activeDungeonRoomId,
      activeBattleMapId,
    },
  }));
  publishWorldChange(worldId, "encounter");
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

  const updated = await withEncounterLock(worldId, async () => {
    const row = await prisma.encounter.findUnique({ where: { worldId } });
    if (!row) return null;

    const combatants: LiveCombatant[] = JSON.parse(row.combatants);
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return undefined;

    const maxHp = target.maxHp ?? 0;
    target.currentHp = Math.max(0, Math.min(maxHp, (target.currentHp ?? 0) + delta));

    return prisma.encounter.update({
      where: { worldId },
      data: { combatants: JSON.stringify(combatants) },
    });
  });
  if (updated === null) return res.status(404).json({ error: "No active encounter for this world" });
  if (updated === undefined) return res.status(404).json({ error: "Combatant not found" });
  publishWorldChange(worldId, "encounter");
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

  const updated = await withEncounterLock(worldId, async () => {
    const row = await prisma.encounter.findUnique({ where: { worldId } });
    if (!row) return { error: 404 as const, message: "No active encounter for this world" };

    const zones: EncounterZone[] = JSON.parse(row.zones);
    const targetZone = zones.find((z) => z.id === zoneId);
    if (!targetZone) return { error: 404 as const, message: "Zone not found" };
    if (!isOwner && !targetZone.revealed) {
      return { error: 403 as const, message: "That zone hasn't been revealed yet" };
    }

    const combatants: LiveCombatant[] = JSON.parse(row.combatants);
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return { error: 404 as const, message: "Combatant not found" };

    if (target.zoneId) {
      const currentZone = zones.find((z) => z.id === target.zoneId);
      const adjacent = (currentZone?.connections.includes(zoneId) ?? false) || targetZone.connections.includes(target.zoneId);
      if (!adjacent) return { error: 400 as const, message: "That zone isn't adjacent" };
    }

    target.zoneId = zoneId;
    return prisma.encounter.update({
      where: { worldId },
      data: { combatants: JSON.stringify(combatants) },
    });
  });
  if ("error" in updated) return res.status(updated.error).json({ error: updated.message });
  publishWorldChange(worldId, "encounter");
  res.json(toEncounterDTO(updated, req.userId!, world.userId));
});

// Narrow write path open to any party member, the grid-mode counterpart to
// move-zone above. Unlike move-zone's "must be adjacent," a token's whole
// remaining movement is one continuous action — so the reachability check
// here is against the map's actual walls/terrain and the combatant's own
// speed (computeReachableCells), not a single-hop rule. The owner never
// hits this endpoint at all (they PUT the whole encounter unconstrained,
// same escape hatch move-zone's adjacency rule relies on), so this is
// purely the trust boundary for everyone else at the table.
encountersRouter.post("/:worldId/move-grid", async (req, res) => {
  const { worldId } = req.params;
  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });
  const isOwner = world.userId === req.userId;

  const { combatantId, gridX, gridY } = req.body ?? {};
  if (typeof combatantId !== "string" || typeof gridX !== "number" || typeof gridY !== "number") {
    return res.status(400).json({ error: "combatantId, gridX, and gridY are required" });
  }
  if (!Number.isInteger(gridX) || !Number.isInteger(gridY) || gridX < 0 || gridY < 0) {
    return res.status(400).json({ error: "gridX and gridY must be non-negative integers" });
  }

  const updated = await withEncounterLock(worldId, async () => {
    const row = await prisma.encounter.findUnique({ where: { worldId } });
    if (!row) return { error: 404 as const, message: "No active encounter for this world" };
    if (!row.activeBattleMapId) return { error: 400 as const, message: "No battle map is loaded for this encounter" };

    const map = await prisma.battleMap.findUnique({ where: { id: row.activeBattleMapId } });
    if (!map) return { error: 404 as const, message: "Battle map not found" };

    const combatants: LiveCombatant[] = JSON.parse(row.combatants);
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return { error: 404 as const, message: "Combatant not found" };

    const footprint = SIZE_FOOTPRINT[target.sizeCategory ?? "medium"];
    if (gridX + footprint > map.width || gridY + footprint > map.height) {
      return { error: 400 as const, message: "That's off the edge of the map" };
    }

    if (!isOwner && typeof target.gridX === "number" && typeof target.gridY === "number") {
      const mapTiles: PlacedTile[] = JSON.parse(map.tiles);
      const reachable = computeReachableCells(
        { width: map.width, height: map.height, tiles: mapTiles },
        target.gridX, target.gridY, target.speedFeet ?? 30,
      );
      if (!reachable.has(`${gridX},${gridY}`)) {
        return { error: 400 as const, message: "That's further than this combatant can move" };
      }
    }

    target.gridX = gridX;
    target.gridY = gridY;
    return prisma.encounter.update({
      where: { worldId },
      data: { combatants: JSON.stringify(combatants) },
    });
  });
  if ("error" in updated) return res.status(updated.error).json({ error: updated.message });
  publishWorldChange(worldId, "encounter");
  res.json(toEncounterDTO(updated, req.userId!, world.userId));
});
