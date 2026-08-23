import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { toDowntimeActivityDTO } from "../serialize.js";
import { getMemberWorldIds } from "../worldAccess.js";
import { publishWorldChange } from "../worldEvents.js";
import {
  DOWNTIME_ACTIVITY_TYPES, DOWNTIME_ACTIVITY_TYPE_LABELS, DOWNTIME_OUTCOME_ACTIVITY_TYPES,
  DOWNTIME_OUTCOMES, computeCraftingCost,
} from "@spark/shared";
import type { DowntimeOutcomeActivityType } from "@spark/shared";

export const downtimeRouter = Router();

async function findAccessibleWorld(userId: string, worldId: string) {
  const memberWorldIds = await getMemberWorldIds(userId);
  return prisma.world.findFirst({ where: { id: worldId, OR: [{ userId }, { id: { in: memberWorldIds } }] } });
}

downtimeRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  if (typeof worldId !== "string") return res.status(400).json({ error: "worldId is required" });

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const rows = await prisma.downtimeActivity.findMany({ where: { worldId }, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toDowntimeActivityDTO));
});

downtimeRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { worldId, playerCharacterId, characterName, activityType, description, daysSpent, outcome, craftedItemId, outcomeId } = body;

  if (
    typeof worldId !== "string" ||
    typeof characterName !== "string" || !characterName.trim() ||
    typeof activityType !== "string" || !(DOWNTIME_ACTIVITY_TYPES as readonly string[]).includes(activityType) ||
    typeof description !== "string" || !description.trim() ||
    typeof daysSpent !== "number" || !Number.isFinite(daysSpent) || daysSpent <= 0 ||
    (craftedItemId !== undefined && typeof craftedItemId !== "string") ||
    (outcomeId !== undefined && typeof outcomeId !== "string")
  ) {
    return res.status(400).json({ error: "Missing or invalid downtime activity fields" });
  }

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  // A picked item is the "smart" path: it automatically debits its crafting
  // cost in gold and credits one of the item to the party ledger, the same
  // way rest/level-up layer a convenience action over a plain create/PATCH.
  // Logging a crafting activity with no item still works exactly as before.
  let craftedItem: { id: string; name: string; value: number } | null = null;
  if (typeof craftedItemId === "string") {
    const memberWorldIds = await getMemberWorldIds(req.userId!);
    craftedItem = await prisma.item.findFirst({
      where: { id: craftedItemId, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] },
      select: { id: true, name: true, value: true },
    });
    if (!craftedItem) return res.status(403).json({ error: "You don't have access to this item" });
  }

  // A rolled outcome is looked up server-side by id, never trusted from the
  // client — the client only ever saw the text/preview, not raw numbers it
  // could tamper with. Same "smart layer over a plain log entry" shape as
  // craftedItem above.
  let resolvedOutcome: { goldDelta?: number; hpRestorePercent?: number } | null = null;
  if (typeof outcomeId === "string") {
    if (!(DOWNTIME_OUTCOME_ACTIVITY_TYPES as readonly string[]).includes(activityType)) {
      return res.status(400).json({ error: "This activity type doesn't support rolled outcomes" });
    }
    resolvedOutcome = DOWNTIME_OUTCOMES[activityType as DowntimeOutcomeActivityType].find((o) => o.id === outcomeId) ?? null;
    if (!resolvedOutcome) return res.status(400).json({ error: "Invalid outcomeId" });
  }

  // Recovery's HP restore only applies to a player character the caller
  // owns — mirrors the same ownership check the ledger's loot-claim
  // endpoint uses for its own currentHp-adjacent write.
  let targetPC: { id: string; currentHp: number; maxHp: number } | null = null;
  if (resolvedOutcome?.hpRestorePercent && typeof playerCharacterId === "string") {
    targetPC = await prisma.playerCharacter.findFirst({
      where: { id: playerCharacterId, userId: req.userId },
      select: { id: true, currentHp: true, maxHp: true },
    });
    if (!targetPC) return res.status(403).json({ error: "You don't have access to this player character" });
  }

  const activityData = {
    worldId,
    playerCharacterId: typeof playerCharacterId === "string" ? playerCharacterId : null,
    characterName: characterName.trim(),
    activityType,
    description: description.trim(),
    daysSpent: Math.trunc(daysSpent),
    outcome: typeof outcome === "string" && outcome.trim() ? outcome.trim() : null,
    craftedItemId: craftedItem?.id ?? null,
    userId: req.userId!,
  };

  let row;
  if (craftedItem) {
    const { goldCost } = computeCraftingCost(craftedItem);
    const authorName = characterName.trim();
    [row] = await prisma.$transaction([
      prisma.downtimeActivity.create({ data: activityData }),
      prisma.ledgerEntry.create({
        data: { worldId, kind: "gold", label: `Crafting: ${craftedItem.name}`, amount: -goldCost, authorName, userId: req.userId! },
      }),
      prisma.ledgerEntry.create({
        data: { worldId, kind: "item", label: craftedItem.name, amount: 1, itemId: craftedItem.id, authorName, userId: req.userId! },
      }),
    ]);
    publishWorldChange(worldId, "ledger");
  } else if (resolvedOutcome && (resolvedOutcome.goldDelta || (resolvedOutcome.hpRestorePercent && targetPC))) {
    const authorName = characterName.trim();
    const ops: Prisma.PrismaPromise<unknown>[] = [prisma.downtimeActivity.create({ data: activityData })];
    if (resolvedOutcome.goldDelta) {
      ops.push(
        prisma.ledgerEntry.create({
          data: {
            worldId, kind: "gold", label: `${DOWNTIME_ACTIVITY_TYPE_LABELS[activityType as DowntimeOutcomeActivityType]}: ${authorName}`,
            amount: Math.trunc(resolvedOutcome.goldDelta), authorName, userId: req.userId!,
          },
        }),
      );
    }
    if (resolvedOutcome.hpRestorePercent && targetPC) {
      const missing = targetPC.maxHp - targetPC.currentHp;
      const heal = Math.max(0, Math.ceil(missing * resolvedOutcome.hpRestorePercent));
      if (heal > 0) {
        ops.push(prisma.playerCharacter.update({ where: { id: targetPC.id }, data: { currentHp: Math.min(targetPC.maxHp, targetPC.currentHp + heal) } }));
      }
    }
    const results = await prisma.$transaction(ops);
    row = results[0] as Awaited<ReturnType<typeof prisma.downtimeActivity.create>>;
    if (resolvedOutcome.goldDelta) publishWorldChange(worldId, "ledger");
  } else {
    row = await prisma.downtimeActivity.create({ data: activityData });
  }
  res.status(201).json(toDowntimeActivityDTO(row));
});

downtimeRouter.delete("/:id", async (req, res) => {
  const row = await prisma.downtimeActivity.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Downtime activity not found" });

  const world = await prisma.world.findUnique({ where: { id: row.worldId } });
  const canDelete = row.userId === req.userId || world?.userId === req.userId;
  if (!canDelete) return res.status(403).json({ error: "You can't delete this downtime activity" });

  await prisma.downtimeActivity.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
