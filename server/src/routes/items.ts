import { Router } from "express";
import { prisma } from "../db.js";
import { toItemDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { findAccessibleWorld, getMemberWorldIds, authorizeEntityWrite } from "../worldAccess.js";

export const itemsRouter = Router();

itemsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = {
    OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }],
    ...(worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.item.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toItemDTO));
});

itemsRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.item.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
  if (!row) return res.status(404).json({ error: "Item not found" });
  res.json(toItemDTO(row));
});

itemsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const {
    name, itemType, category, rarity, description, property, history, worldId, tags, notes,
    rarityTier, bonusType, bonusValue, requiresAttunement, charges, rechargeRule, value, weight, hiddenFromParty,
  } = body;

  if (!name || !itemType || !category || !rarity || !description || !property || !history) {
    return res.status(400).json({ error: "Missing required item fields" });
  }
  if (typeof worldId === "string") {
    const world = await findAccessibleWorld(req.userId!, worldId);
    if (!world) return res.status(403).json({ error: "You don't have access to this world" });
  }

  const row = await prisma.item.create({
    data: {
      name, itemType, category, rarity, description, property, history,
      rarityTier: typeof rarityTier === "number" ? rarityTier : 0,
      bonusType: bonusType ?? "none",
      bonusValue: typeof bonusValue === "number" ? bonusValue : 0,
      requiresAttunement: !!requiresAttunement,
      charges: typeof charges === "number" ? charges : null,
      rechargeRule: rechargeRule ?? null,
      value: typeof value === "number" ? value : 0,
      weight: typeof weight === "number" && Number.isFinite(weight) && weight >= 0 ? weight : null,
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
      hiddenFromParty: !!hiddenFromParty,
      userId: req.userId!,
    },
  });
  res.status(201).json(toItemDTO(row));
});

itemsRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of [
    "name", "itemType", "category", "rarity", "description", "property", "history", "notes", "hiddenFromParty",
    "rarityTier", "bonusType", "bonusValue", "requiresAttunement", "charges", "rechargeRule", "value",
  ] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("weight" in body) {
    data.weight = typeof body.weight === "number" && Number.isFinite(body.weight) && body.weight >= 0 ? body.weight : null;
  }
  if ("worldId" in body) {
    if (typeof body.worldId === "string") {
      const world = await findAccessibleWorld(req.userId!, body.worldId);
      if (!world) return res.status(403).json({ error: "You don't have access to this world" });
    }
    data.worldId = body.worldId ?? null;
  }
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  const existing = await prisma.item.findUnique({ where: { id: req.params.id } });
  if (!(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Item not found" });
  }
  const row = await prisma.item.update({ where: { id: req.params.id }, data });
  res.json(toItemDTO(row));
});

itemsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.item.findUnique({ where: { id: req.params.id } });
  if (!(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Item not found" });
  }
  await prisma.item.delete({ where: { id: req.params.id } });
  await deleteLinksForEntity("item", req.params.id, req.userId!);
  res.status(204).end();
});
