import { Router } from "express";
import { prisma } from "../db.js";

export const worldsRouter = Router();

worldsRouter.get("/", async (_req, res) => {
  const rows = await prisma.world.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          characters: true, items: true, locations: true, questHooks: true,
          factions: true, encounterTables: true, sessionNotes: true,
        },
      },
    },
  });
  res.json(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      characterCount: row._count.characters,
      itemCount: row._count.items,
      locationCount: row._count.locations,
      questCount: row._count.questHooks,
      factionCount: row._count.factions,
      encounterTableCount: row._count.encounterTables,
      sessionNoteCount: row._count.sessionNotes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }))
  );
});

worldsRouter.get("/:id", async (req, res) => {
  const row = await prisma.world.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "World not found" });
  res.json({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

worldsRouter.post("/", async (req, res) => {
  const { name, description } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "World name is required" });
  const row = await prisma.world.create({ data: { name, description: description ?? null } });
  res.status(201).json(row);
});

worldsRouter.patch("/:id", async (req, res) => {
  const { name, description } = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  try {
    const row = await prisma.world.update({ where: { id: req.params.id }, data });
    res.json(row);
  } catch {
    res.status(404).json({ error: "World not found" });
  }
});

worldsRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.world.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "World not found" });
  }
});
