import { Router } from "express";
import { prisma } from "../db.js";

export const worldsRouter = Router();

worldsRouter.get("/", async (req, res) => {
  const rows = await prisma.world.findMany({
    where: { userId: req.userId },
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
  const row = await prisma.world.findFirst({ where: { id: req.params.id, userId: req.userId } });
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
  const row = await prisma.world.create({ data: { name, description: description ?? null, userId: req.userId! } });
  res.status(201).json(row);
});

worldsRouter.patch("/:id", async (req, res) => {
  const { name, description } = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;

  const result = await prisma.world.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ error: "World not found" });
  const row = await prisma.world.findUnique({ where: { id: req.params.id } });
  res.json(row);
});

worldsRouter.delete("/:id", async (req, res) => {
  const result = await prisma.world.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "World not found" });
  res.status(204).end();
});
