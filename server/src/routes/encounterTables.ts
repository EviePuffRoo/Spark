import { Router } from "express";
import { prisma } from "../db.js";
import { toEncounterTableDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";

export const encounterTablesRouter = Router();

encounterTablesRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const where =
    worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {};
  const rows = await prisma.encounterTable.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toEncounterTableDTO));
});

encounterTablesRouter.get("/:id", async (req, res) => {
  const row = await prisma.encounterTable.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Encounter table not found" });
  res.json(toEncounterTableDTO(row));
});

encounterTablesRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { name, terrain, entries, worldId, tags, notes } = body;

  if (!name || !terrain || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: "Missing required encounter table fields" });
  }

  const row = await prisma.encounterTable.create({
    data: {
      name, terrain,
      entries: JSON.stringify(entries),
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
    },
  });
  res.status(201).json(toEncounterTableDTO(row));
});

encounterTablesRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["name", "terrain", "notes"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("entries" in body) data.entries = JSON.stringify(body.entries);
  if ("worldId" in body) data.worldId = body.worldId ?? null;
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  try {
    const row = await prisma.encounterTable.update({ where: { id: req.params.id }, data });
    res.json(toEncounterTableDTO(row));
  } catch {
    res.status(404).json({ error: "Encounter table not found" });
  }
});

encounterTablesRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.encounterTable.delete({ where: { id: req.params.id } });
    await deleteLinksForEntity("encounterTable", req.params.id);
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Encounter table not found" });
  }
});
