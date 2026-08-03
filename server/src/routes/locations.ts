import { Router } from "express";
import { prisma } from "../db.js";
import { toLocationDTO } from "../serialize.js";

export const locationsRouter = Router();

locationsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const where =
    worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {};
  const rows = await prisma.location.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toLocationDTO));
});

locationsRouter.get("/:id", async (req, res) => {
  const row = await prisma.location.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Location not found" });
  res.json(toLocationDTO(row));
});

locationsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { name, locationType, category, description, notableFeature, keeper, rumor, worldId, tags, notes } = body;

  if (!name || !locationType || !category || !description || !notableFeature || !keeper || !rumor) {
    return res.status(400).json({ error: "Missing required location fields" });
  }

  const row = await prisma.location.create({
    data: {
      name, locationType, category, description, notableFeature, keeper, rumor,
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
    },
  });
  res.status(201).json(toLocationDTO(row));
});

locationsRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["name", "locationType", "category", "description", "notableFeature", "keeper", "rumor", "notes"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("worldId" in body) data.worldId = body.worldId ?? null;
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  try {
    const row = await prisma.location.update({ where: { id: req.params.id }, data });
    res.json(toLocationDTO(row));
  } catch {
    res.status(404).json({ error: "Location not found" });
  }
});

locationsRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.location.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Location not found" });
  }
});
