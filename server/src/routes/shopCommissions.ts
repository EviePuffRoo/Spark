import { Router } from "express";
import { prisma } from "../db.js";
import { toShopCommissionDTO } from "../serialize.js";
import { findAccessibleWorld, getMemberWorldIds } from "../worldAccess.js";
import { publishWorldChange } from "../worldEvents.js";
import { computeCraftingCost } from "@spark/shared";

export const shopCommissionsRouter = Router();

shopCommissionsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  if (typeof worldId !== "string") return res.status(400).json({ error: "worldId is required" });

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const rows = await prisma.shopCommission.findMany({ where: { worldId }, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toShopCommissionDTO));
});

// Commissioning is the "smart" path over a shop's plain stock buy: instead
// of an in-stock item bought instantly, this pays the crafting cost (see
// computeCraftingCost) up front and leaves the item pending until the DM
// marks it delivered — representing the crafter's in-fiction turnaround.
shopCommissionsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { worldId, shopId, itemId, characterName } = body;

  if (
    typeof worldId !== "string" || typeof shopId !== "string" || typeof itemId !== "string" ||
    typeof characterName !== "string" || !characterName.trim()
  ) {
    return res.status(400).json({ error: "worldId, shopId, itemId, and characterName are required" });
  }

  const world = await findAccessibleWorld(req.userId!, worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const shop = await prisma.shop.findFirst({ where: { id: shopId, worldId, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
  if (!shop) return res.status(404).json({ error: "Shop not found" });

  const item = await prisma.item.findFirst({
    where: { id: itemId, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] },
    select: { id: true, name: true, value: true },
  });
  if (!item) return res.status(403).json({ error: "You don't have access to this item" });

  const { goldCost, daysRequired } = computeCraftingCost(item);
  const name = characterName.trim();

  const [commission] = await prisma.$transaction([
    prisma.shopCommission.create({
      data: {
        worldId, shopId, itemId: item.id, itemName: item.name, price: goldCost, daysRequired,
        characterName: name, userId: req.userId!,
      },
    }),
    prisma.ledgerEntry.create({
      data: { worldId, kind: "gold", label: `Commissioned ${item.name} from ${shop.name}`, amount: -goldCost, authorName: name, userId: req.userId! },
    }),
  ]);
  publishWorldChange(worldId, "ledger");
  res.status(201).json(toShopCommissionDTO(commission));
});

// DM-only: marks the commission delivered and credits the item to the
// party ledger. Ownership is checked against the world, not the shop or
// the commission's own creator, since delivering is a GM call advancing
// in-fiction time, not something the commissioning player does themself.
shopCommissionsRouter.post("/:id/deliver", async (req, res) => {
  const commission = await prisma.shopCommission.findUnique({ where: { id: req.params.id }, include: { world: true } });
  if (!commission) return res.status(404).json({ error: "Commission not found" });
  if (commission.world.userId !== req.userId) return res.status(403).json({ error: "Only the world's owner can deliver a commission" });
  if (commission.deliveredAt) return res.status(400).json({ error: "This commission has already been delivered" });

  const [updated] = await prisma.$transaction([
    prisma.shopCommission.update({ where: { id: commission.id }, data: { deliveredAt: new Date() } }),
    prisma.ledgerEntry.create({
      data: {
        worldId: commission.worldId, kind: "item", label: commission.itemName, amount: 1, itemId: commission.itemId,
        authorName: commission.characterName, userId: req.userId!,
      },
    }),
  ]);
  publishWorldChange(commission.worldId, "ledger");
  res.json(toShopCommissionDTO(updated));
});
