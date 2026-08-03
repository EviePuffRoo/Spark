import { Router } from "express";
import { prisma } from "../db.js";
import { toEncounterTableDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { getMemberWorldIds } from "../worldAccess.js";

export const encounterTablesRouter = Router();

encounterTablesRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = {
    OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }],
    ...(worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.encounterTable.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toEncounterTableDTO));
});

encounterTablesRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.encounterTable.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
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
      userId: req.userId!,
    },
  });
  res.status(201).json(toEncounterTableDTO(row));
});

encounterTablesRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["name", "terrain", "notes", "hiddenFromParty"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("entries" in body) data.entries = JSON.stringify(body.entries);
  if ("worldId" in body) data.worldId = body.worldId ?? null;
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  const result = await prisma.encounterTable.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ error: "Encounter table not found" });
  const row = await prisma.encounterTable.findUnique({ where: { id: req.params.id } });
  res.json(toEncounterTableDTO(row!));
});

encounterTablesRouter.delete("/:id", async (req, res) => {
  const result = await prisma.encounterTable.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Encounter table not found" });
  await deleteLinksForEntity("encounterTable", req.params.id, req.userId!);
  res.status(204).end();
});
