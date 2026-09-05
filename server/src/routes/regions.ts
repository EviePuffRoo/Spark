import { Router } from "express";
import { prisma } from "../db.js";
import { toRegionDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { findAccessibleWorld, getMemberWorldIds, authorizeEntityWrite, listVisibleWhere, visibleEntityWhere } from "../worldAccess.js";

export const regionsRouter = Router();

regionsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = listVisibleWhere(req.userId!, memberWorldIds, worldId);
  const rows = await prisma.region.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toRegionDTO));
});

regionsRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.region.findFirst({ where: { id: req.params.id, ...visibleEntityWhere(req.userId!, memberWorldIds) } });
  if (!row) return res.status(404).json({ error: "Region not found" });
  res.json(toRegionDTO(row));
});

regionsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { name, terrainCategory, dangerLevel, description, worldId, tags, notes, x, y, hiddenFromParty } = body;

  if (!name || !terrainCategory || !description) {
    return res.status(400).json({ error: "Missing required region fields" });
  }
  if (typeof worldId === "string") {
    const world = await findAccessibleWorld(req.userId!, worldId);
    if (!world) return res.status(403).json({ error: "You don't have access to this world" });
  }

  const row = await prisma.region.create({
    data: {
      name, terrainCategory, description,
      dangerLevel: dangerLevel ?? null,
      worldId: worldId ?? null,
      x: typeof x === "number" ? x : 0,
      y: typeof y === "number" ? y : 0,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
      hiddenFromParty: !!hiddenFromParty,
      userId: req.userId!,
    },
  });
  res.status(201).json(toRegionDTO(row));
});

regionsRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["name", "terrainCategory", "description", "dangerLevel", "notes", "hiddenFromParty"] as const) {
    if (field in body) data[field] = body[field];
  }
  for (const field of ["x", "y"] as const) {
    if (field in body) data[field] = Number(body[field]);
  }
  if ("worldId" in body) {
    if (typeof body.worldId === "string") {
      const world = await findAccessibleWorld(req.userId!, body.worldId);
      if (!world) return res.status(403).json({ error: "You don't have access to this world" });
    }
    data.worldId = body.worldId ?? null;
  }
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);
  if ("connections" in body) {
    data.connections = JSON.stringify(Array.isArray(body.connections) ? body.connections.filter((c: unknown) => typeof c === "string") : []);
  }

  const existing = await prisma.region.findUnique({ where: { id: req.params.id } });
  if (!(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Region not found" });
  }
  const row = await prisma.region.update({ where: { id: req.params.id }, data });
  res.json(toRegionDTO(row));
});

regionsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.region.findUnique({ where: { id: req.params.id } });
  if (!(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Region not found" });
  }
  await prisma.region.delete({ where: { id: req.params.id } });
  await deleteLinksForEntity("region", req.params.id, req.userId!);
  res.status(204).end();
});
