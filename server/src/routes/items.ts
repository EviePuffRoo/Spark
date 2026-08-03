import { Router } from "express";
import { prisma } from "../db.js";
import { toItemDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { getMemberWorldIds } from "../worldAccess.js";

export const itemsRouter = Router();

itemsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = {
    OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds } }],
    ...(worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.item.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toItemDTO));
});

itemsRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.item.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds } }] } });
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
      userId: req.userId!,
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

  const result = await prisma.item.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ error: "Item not found" });
  const row = await prisma.item.findUnique({ where: { id: req.params.id } });
  res.json(toItemDTO(row!));
});

itemsRouter.delete("/:id", async (req, res) => {
  const result = await prisma.item.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Item not found" });
  await deleteLinksForEntity("item", req.params.id, req.userId!);
  res.status(204).end();
});
