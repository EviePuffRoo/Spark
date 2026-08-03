import { Router } from "express";
import { prisma } from "../db.js";
import { toItemDTO } from "../serialize.js";

export const itemsRouter = Router();

itemsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const where =
    worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {};
  const rows = await prisma.item.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toItemDTO));
});

itemsRouter.get("/:id", async (req, res) => {
  const row = await prisma.item.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Item not found" });
  res.json(toItemDTO(row));
});

itemsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { name, itemType, category, rarity, description, property, history, worldId, tags, notes } = body;

  if (!name || !itemType || !category || !rarity || !description || !property || !history) {
    return res.status(400).json({ error: "Missing required item fields" });
  }

  const row = await prisma.item.create({
    data: {
      name, itemType, category, rarity, description, property, history,
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
    },
  });
  res.status(201).json(toItemDTO(row));
});

itemsRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["name", "itemType", "category", "rarity", "description", "property", "history", "notes"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("worldId" in body) data.worldId = body.worldId ?? null;
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  try {
    const row = await prisma.item.update({ where: { id: req.params.id }, data });
    res.json(toItemDTO(row));
  } catch {
    res.status(404).json({ error: "Item not found" });
  }
});

itemsRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.item.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Item not found" });
  }
});
