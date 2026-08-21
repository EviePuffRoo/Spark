import { Router } from "express";
import { prisma } from "../db.js";
import { findAccessibleWorld } from "../worldAccess.js";
import { publishWorldChange } from "../worldEvents.js";
import { BASE_UPGRADES, generateShop } from "@spark/shared";
import type { BaseState, BaseUnlockedShop } from "@spark/shared";

export const baseRouter = Router();

const UPGRADE_BY_ID = new Map(BASE_UPGRADES.map((u) => [u.id, u]));

// Purchases read the current gold total and acquired-upgrade set before
// deciding whether to write — the same read-modify-write shape that
// proved to race on SQLite for encounter updates (see withEncounterLock
// in encounters.ts). A per-world in-memory lock serializes purchases the
// same way, so two concurrent requests can't both spend gold the party
// doesn't have twice over, or both claim two sides of an exclusive group.
const baseLocks = new Map<string, Promise<unknown>>();
function withBaseLock<T>(worldId: string, fn: () => Promise<T>): Promise<T> {
  const prior = baseLocks.get(worldId) ?? Promise.resolve();
  const next = prior.then(fn, fn);
  baseLocks.set(worldId, next.catch(() => {}));
  return next;
}

async function loadBaseState(worldId: string, ownerUserId: string): Promise<BaseState> {
  const [base, goldAgg, owner] = await Promise.all([
    prisma.base.upsert({
      where: { worldId },
      create: { worldId },
      update: {},
      include: { upgrades: true },
    }),
    prisma.ledgerEntry.aggregate({ where: { worldId, kind: "gold" }, _sum: { amount: true } }),
    prisma.user.findUnique({ where: { id: ownerUserId }, select: { tier: true } }),
  ]);

  let defenseRating = 0;
  for (const row of base.upgrades) {
    const effect = UPGRADE_BY_ID.get(row.upgradeId)?.effect;
    if (effect?.kind === "defenseRating") defenseRating += effect.value;
  }

  const shopRows = base.upgrades.filter((u) => u.shopId);
  const shops = shopRows.length
    ? await prisma.shop.findMany({ where: { id: { in: shopRows.map((u) => u.shopId!) } }, select: { id: true, name: true } })
    : [];
  const shopNameById = new Map(shops.map((s) => [s.id, s.name]));
  const unlockedShops: BaseUnlockedShop[] = shopRows
    .filter((u) => shopNameById.has(u.shopId!))
    .map((u) => ({ upgradeId: u.upgradeId, shopId: u.shopId!, shopName: shopNameById.get(u.shopId!)! }));

  return {
    worldId,
    name: base.name,
    level: base.upgrades.length,
    gold: goldAgg._sum.amount ?? 0,
    isPaid: owner?.tier === "paid",
    defenseRating,
    acquiredUpgradeIds: base.upgrades.map((u) => u.upgradeId),
    unlockedShops,
  };
}

baseRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  if (typeof worldId !== "string") return res.status(400).json({ error: "worldId is required" });

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  res.json(await loadBaseState(worldId, world.userId));
});

baseRouter.post("/purchase", async (req, res) => {
  const { worldId, upgradeId, factionId, rivalFactionId } = req.body ?? {};
  if (typeof worldId !== "string" || typeof upgradeId !== "string") {
    return res.status(400).json({ error: "worldId and upgradeId are required" });
  }
  if (factionId !== undefined && typeof factionId !== "string") {
    return res.status(400).json({ error: "factionId must be a string" });
  }
  if (rivalFactionId !== undefined && typeof rivalFactionId !== "string") {
    return res.status(400).json({ error: "rivalFactionId must be a string" });
  }

  const def = UPGRADE_BY_ID.get(upgradeId);
  if (!def) return res.status(400).json({ error: "Unknown upgrade" });

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  // Both faction choices are optional (a world might not have a relevant
  // faction yet), but if given, they must actually belong to this world —
  // otherwise a reputation delta could land on a faction from an entirely
  // different campaign.
  if (def.effect?.kind === "reputationDelta") {
    for (const id of [factionId, rivalFactionId].filter((v): v is string => typeof v === "string")) {
      const faction = await prisma.faction.findFirst({ where: { id, worldId } });
      if (!faction) return res.status(400).json({ error: "That faction isn't part of this world" });
    }
  } else if (factionId || rivalFactionId) {
    return res.status(400).json({ error: "This upgrade has no faction effect to apply" });
  }

  // Gated on the world owner's tier, not the acting user's — this is the
  // DM's subscription paying for a perk the whole table gets, the same
  // way a player without any subscription of their own can still roll
  // dice in a paid DM's world.
  const owner = await prisma.user.findUnique({ where: { id: world.userId }, select: { tier: true } });
  if (owner?.tier !== "paid") {
    return res.status(403).json({ error: "The home base is a paid feature — upgrade to invest in it.", code: "base_paid_only" });
  }

  const actor = await prisma.user.findUnique({ where: { id: req.userId! }, select: { displayName: true, username: true } });

  // Generated up front (pure/random, no DB) so the transaction below only
  // ever does writes — the shop's actual content doesn't depend on
  // anything decided inside the locked section.
  const shopToCreate = def.effect?.kind === "shopUnlock"
    ? (() => {
        const generated = generateShop({ archetype: def.effect!.archetype, stockSize: def.effect!.stockSize });
        const multiplier = def.effect!.priceMultiplier ?? 1;
        return { ...generated, stock: generated.stock.map((s) => ({ ...s, price: Math.max(1, Math.round(s.price * multiplier)) })) };
      })()
    : null;

  try {
    await withBaseLock(worldId, async () => {
      const base = await prisma.base.upsert({
        where: { worldId },
        create: { worldId },
        update: {},
        include: { upgrades: true },
      });

      const acquiredIds = new Set(base.upgrades.map((u) => u.upgradeId));
      if (acquiredIds.has(upgradeId)) throw new Error("already_acquired");
      if (def.prerequisiteIds?.some((id) => !acquiredIds.has(id))) throw new Error("prerequisites_not_met");
      if (def.exclusiveGroup && base.upgrades.some((u) => UPGRADE_BY_ID.get(u.upgradeId)?.exclusiveGroup === def.exclusiveGroup)) {
        throw new Error("exclusive_conflict");
      }

      const goldAgg = await prisma.ledgerEntry.aggregate({ where: { worldId, kind: "gold" }, _sum: { amount: true } });
      if ((goldAgg._sum.amount ?? 0) < def.cost) throw new Error("insufficient_gold");

      await prisma.$transaction(async (tx) => {
        const upgradeRow = await tx.baseUpgrade.create({ data: { baseId: base.id, upgradeId } });

        if (shopToCreate) {
          const shop = await tx.shop.create({
            data: {
              name: shopToCreate.name,
              description: shopToCreate.description,
              stock: JSON.stringify(shopToCreate.stock),
              worldId,
              tags: JSON.stringify(["base-upgrade"]),
              hiddenFromParty: false,
              userId: world!.userId,
            },
          });
          await tx.baseUpgrade.update({ where: { id: upgradeRow.id }, data: { shopId: shop.id } });
        }

        if (def.effect?.kind === "reputationDelta") {
          if (factionId) {
            await tx.faction.update({ where: { id: factionId }, data: { reputation: { increment: def.effect.value } } });
          }
          if (rivalFactionId && def.effect.rivalValue !== undefined) {
            await tx.faction.update({ where: { id: rivalFactionId }, data: { reputation: { increment: def.effect.rivalValue } } });
          }
        }

        await tx.ledgerEntry.create({
          data: {
            worldId, kind: "gold", label: `Base upgrade: ${def.name}`, amount: -def.cost,
            authorName: actor?.displayName || actor?.username || "The Base", userId: req.userId!,
          },
        });
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const messages: Record<string, string> = {
      already_acquired: "Already acquired",
      prerequisites_not_met: "Prerequisites not met",
      exclusive_conflict: "The base has already committed to a different path here",
      insufficient_gold: "Not enough gold",
    };
    if (messages[message]) return res.status(400).json({ error: messages[message] });
    throw err;
  }

  publishWorldChange(worldId, "ledger");
  res.status(201).json(await loadBaseState(worldId, world.userId));
});
