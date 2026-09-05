import { Router } from "express";
import { prisma } from "../db.js";
import { toShopDTO, toLedgerEntryDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { findAccessibleWorld, getMemberWorldIds, authorizeEntityWrite, listVisibleWhere, visibleEntityWhere } from "../worldAccess.js";
import { publishWorldChange } from "../worldEvents.js";
import type { ShopStockEntry } from "@spark/shared";

export const shopsRouter = Router();

function coerceStockEntry(raw: unknown): ShopStockEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== "string" || typeof s.itemId !== "string" || typeof s.itemName !== "string") return null;
  if (typeof s.price !== "number" || typeof s.quantity !== "number") return null;
  // -1 is the deliberate "unlimited stock" sentinel (see ShopPage.tsx);
  // any other negative quantity is invalid, same as a negative price.
  if (s.price < 0 || (s.quantity < 0 && s.quantity !== -1)) return null;
  return {
    id: s.id,
    itemId: s.itemId,
    itemName: s.itemName,
    price: s.price,
    quantity: s.quantity,
  };
}

shopsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = listVisibleWhere(req.userId!, memberWorldIds, worldId);
  const rows = await prisma.shop.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toShopDTO));
});

shopsRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.shop.findFirst({ where: { id: req.params.id, ...visibleEntityWhere(req.userId!, memberWorldIds) } });
  if (!row) return res.status(404).json({ error: "Shop not found" });
  res.json(toShopDTO(row));
});

shopsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { name, description, stock, worldId, tags, notes, hiddenFromParty, settlementId } = body;

  if (!name || !Array.isArray(stock)) {
    return res.status(400).json({ error: "Missing required shop fields" });
  }
  if (typeof worldId === "string") {
    const world = await findAccessibleWorld(req.userId!, worldId);
    if (!world) return res.status(403).json({ error: "You don't have access to this world" });
  }
  if (typeof settlementId === "string") {
    const memberWorldIds = await getMemberWorldIds(req.userId!);
    const settlement = await prisma.settlement.findFirst({ where: { id: settlementId, ...visibleEntityWhere(req.userId!, memberWorldIds) } });
    if (!settlement) return res.status(403).json({ error: "You don't have access to this settlement" });
  }
  const coercedStock = stock.map(coerceStockEntry).filter((s: ShopStockEntry | null): s is ShopStockEntry => s !== null);

  const row = await prisma.shop.create({
    data: {
      name,
      description: description ?? null,
      stock: JSON.stringify(coercedStock),
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
      hiddenFromParty: !!hiddenFromParty,
      settlementId: settlementId ?? null,
      userId: req.userId!,
    },
  });
  res.status(201).json(toShopDTO(row));
});

// Buys `quantity` of a stocked item, in one transaction: decrements the
// shop's stock (unless it's the -1 "unlimited" sentinel), and writes a
// paired gold-debit + item-credit LedgerEntry — the same two-row shape
// Character Progression Phase C already established for loot, so a
// purchased item is immediately claimable onto a PC exactly like loot is.
// Publishing "ledger" (not a new WorldChangeKind) is enough for the
// buyer's InventoryPage to pick this up live — no shop-specific live
// channel needed for an action only the buyer's own screen needs to see
// update immediately.
shopsRouter.post("/:id/purchase", async (req, res) => {
  const { itemId, quantity, buyerName } = req.body ?? {};
  if (
    typeof itemId !== "string" ||
    typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0 ||
    typeof buyerName !== "string" || !buyerName.trim()
  ) {
    return res.status(400).json({ error: "itemId, a positive integer quantity, and buyerName are required" });
  }

  const shop = await prisma.shop.findUnique({ where: { id: req.params.id } });
  if (!shop) return res.status(404).json({ error: "Shop not found" });
  if (!shop.worldId) return res.status(400).json({ error: "This shop isn't assigned to a world" });

  const world = await findAccessibleWorld(req.userId!, shop.worldId);
  if (!world) return res.status(403).json({ error: "You don't have access to this world" });

  const stock: ShopStockEntry[] = JSON.parse(shop.stock);
  const entry = stock.find((s) => s.itemId === itemId);
  if (!entry) return res.status(404).json({ error: "That item isn't stocked at this shop" });
  if (entry.quantity !== -1 && entry.quantity < quantity) {
    return res.status(400).json({ error: "Not enough stock" });
  }

  const totalPrice = entry.price * quantity;
  const goldAgg = await prisma.ledgerEntry.aggregate({ where: { worldId: shop.worldId, kind: "gold" }, _sum: { amount: true } });
  const gold = goldAgg._sum.amount ?? 0;
  if (gold < totalPrice) {
    return res.status(400).json({ error: "Not enough gold in the party ledger" });
  }

  const nextStock = entry.quantity === -1
    ? stock
    : stock.map((s) => (s.itemId === itemId ? { ...s, quantity: s.quantity - quantity } : s));

  const [updatedShop, goldEntry, itemEntry] = await prisma.$transaction([
    prisma.shop.update({ where: { id: shop.id }, data: { stock: JSON.stringify(nextStock) } }),
    prisma.ledgerEntry.create({
      data: {
        worldId: shop.worldId, kind: "gold",
        label: `Bought ${quantity} × ${entry.itemName} from ${shop.name}`,
        amount: -totalPrice, authorName: buyerName.trim(), userId: req.userId!,
      },
    }),
    prisma.ledgerEntry.create({
      data: {
        worldId: shop.worldId, kind: "item", label: entry.itemName,
        amount: quantity, itemId: entry.itemId, authorName: buyerName.trim(), userId: req.userId!,
      },
    }),
  ]);
  publishWorldChange(shop.worldId, "ledger");

  res.status(201).json({
    shop: toShopDTO(updatedShop),
    goldEntry: toLedgerEntryDTO(goldEntry),
    itemEntry: toLedgerEntryDTO(itemEntry),
  });
});

shopsRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["name", "description", "notes", "hiddenFromParty"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("stock" in body) {
    const coercedStock = Array.isArray(body.stock) ? body.stock.map(coerceStockEntry).filter((s: ShopStockEntry | null): s is ShopStockEntry => s !== null) : [];
    data.stock = JSON.stringify(coercedStock);
  }
  if ("worldId" in body) {
    if (typeof body.worldId === "string") {
      const world = await findAccessibleWorld(req.userId!, body.worldId);
      if (!world) return res.status(403).json({ error: "You don't have access to this world" });
    }
    data.worldId = body.worldId ?? null;
  }
  if ("settlementId" in body) {
    if (typeof body.settlementId === "string") {
      const memberWorldIds = await getMemberWorldIds(req.userId!);
      const settlement = await prisma.settlement.findFirst({ where: { id: body.settlementId, ...visibleEntityWhere(req.userId!, memberWorldIds) } });
      if (!settlement) return res.status(403).json({ error: "You don't have access to this settlement" });
    }
    data.settlementId = body.settlementId ?? null;
  }
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  const existing = await prisma.shop.findUnique({ where: { id: req.params.id } });
  if (!(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Shop not found" });
  }
  const row = await prisma.shop.update({ where: { id: req.params.id }, data });
  res.json(toShopDTO(row));
});

shopsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.shop.findUnique({ where: { id: req.params.id } });
  if (!(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Shop not found" });
  }
  await prisma.shop.delete({ where: { id: req.params.id } });
  await deleteLinksForEntity("shop", req.params.id, req.userId!);
  res.status(204).end();
});
