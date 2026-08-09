import { Router } from "express";
import { prisma } from "../db.js";
import { toShopDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { getMemberWorldIds } from "../worldAccess.js";
import type { ShopStockEntry } from "@spark/shared";

export const shopsRouter = Router();

function coerceStockEntry(raw: unknown): ShopStockEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== "string" || typeof s.itemId !== "string" || typeof s.itemName !== "string") return null;
  if (typeof s.price !== "number" || typeof s.quantity !== "number") return null;
  if (s.price < 0) return null;
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
  const where = {
    OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }],
    ...(worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.shop.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toShopDTO));
});

shopsRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.shop.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
  if (!row) return res.status(404).json({ error: "Shop not found" });
  res.json(toShopDTO(row));
});

shopsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { name, description, stock, worldId, tags, notes } = body;

  if (!name || !Array.isArray(stock)) {
    return res.status(400).json({ error: "Missing required shop fields" });
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
      userId: req.userId!,
    },
  });
  res.status(201).json(toShopDTO(row));
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
  if ("worldId" in body) data.worldId = body.worldId ?? null;
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  const result = await prisma.shop.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ error: "Shop not found" });
  const row = await prisma.shop.findUnique({ where: { id: req.params.id } });
  res.json(toShopDTO(row!));
});

shopsRouter.delete("/:id", async (req, res) => {
  const result = await prisma.shop.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Shop not found" });
  await deleteLinksForEntity("shop", req.params.id, req.userId!);
  res.status(204).end();
});
