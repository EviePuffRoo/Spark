import { Router } from "express";
import { prisma } from "../db.js";
import { toFactionDTO } from "../serialize.js";

export const factionsRouter = Router();

factionsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const where =
    worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {};
  const rows = await prisma.faction.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toFactionDTO));
});

factionsRouter.get("/:id", async (req, res) => {
  const row = await prisma.faction.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Faction not found" });
  res.json(toFactionDTO(row));
});

factionsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { name, factionType, agenda, methods, publicFace, hook, worldId, tags, notes } = body;

  if (!name || !factionType || !agenda || !methods || !publicFace || !hook) {
    return res.status(400).json({ error: "Missing required faction fields" });
  }

  const row = await prisma.faction.create({
    data: {
      name, factionType, agenda, methods, publicFace, hook,
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
    },
  });
  res.status(201).json(toFactionDTO(row));
});

factionsRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["name", "factionType", "agenda", "methods", "publicFace", "hook", "notes"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("worldId" in body) data.worldId = body.worldId ?? null;
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  try {
    const row = await prisma.faction.update({ where: { id: req.params.id }, data });
    res.json(toFactionDTO(row));
  } catch {
    res.status(404).json({ error: "Faction not found" });
  }
});

factionsRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.faction.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Faction not found" });
  }
});
