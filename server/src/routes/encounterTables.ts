import { Router } from "express";
import { prisma } from "../db.js";
import { toEncounterTableDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { findAccessibleWorld, getMemberWorldIds, authorizeEntityWrite, listVisibleWhere, visibleEntityWhere } from "../worldAccess.js";

export const encounterTablesRouter = Router();

encounterTablesRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = listVisibleWhere(req.userId!, memberWorldIds, worldId);
  const rows = await prisma.encounterTable.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toEncounterTableDTO));
});

encounterTablesRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.encounterTable.findFirst({ where: { id: req.params.id, ...visibleEntityWhere(req.userId!, memberWorldIds) } });
  if (!row) return res.status(404).json({ error: "Encounter table not found" });
  res.json(toEncounterTableDTO(row));
});

encounterTablesRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { name, terrain, entries, worldId, tags, notes, hiddenFromParty } = body;

  if (!name || !terrain || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: "Missing required encounter table fields" });
  }
  if (typeof worldId === "string") {
    const world = await findAccessibleWorld(req.userId!, worldId);
    if (!world) return res.status(403).json({ error: "You don't have access to this world" });
  }

  const row = await prisma.encounterTable.create({
    data: {
      name, terrain,
      entries: JSON.stringify(entries),
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
      hiddenFromParty: !!hiddenFromParty,
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
  if ("worldId" in body) {
    if (typeof body.worldId === "string") {
      const world = await findAccessibleWorld(req.userId!, body.worldId);
      if (!world) return res.status(403).json({ error: "You don't have access to this world" });
    }
    data.worldId = body.worldId ?? null;
  }
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  const existing = await prisma.encounterTable.findUnique({ where: { id: req.params.id } });
  if (!(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Encounter table not found" });
  }
  const row = await prisma.encounterTable.update({ where: { id: req.params.id }, data });
  res.json(toEncounterTableDTO(row));
});

encounterTablesRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.encounterTable.findUnique({ where: { id: req.params.id } });
  if (!(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Encounter table not found" });
  }
  await prisma.encounterTable.delete({ where: { id: req.params.id } });
  await deleteLinksForEntity("encounterTable", req.params.id, req.userId!);
  res.status(204).end();
});
