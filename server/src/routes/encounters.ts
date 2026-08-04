import { Router } from "express";
import { prisma } from "../db.js";
import { toEncounterDTO } from "../serialize.js";
import { getMemberWorldIds } from "../worldAccess.js";
import type { LiveCombatant, CombatantKind } from "@spark/shared";

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
  };
}

encountersRouter.get("/:worldId", async (req, res) => {
  const { worldId } = req.params;
  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const row = await prisma.encounter.findUnique({ where: { worldId } });
  if (!row) {
    return res.json({ worldId, combatants: [], round: 1, turnIndex: 0, updatedAt: null });
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

  const row = await prisma.encounter.upsert({
    where: { worldId },
    create: {
      worldId,
      combatants: JSON.stringify(combatants),
      round: Number(body.round) || 1,
      turnIndex: Number(body.turnIndex) || 0,
    },
    update: {
      combatants: JSON.stringify(combatants),
      round: Number(body.round) || 1,
      turnIndex: Number(body.turnIndex) || 0,
    },
  });
  res.json(toEncounterDTO(row, req.userId!, world.userId));
});
