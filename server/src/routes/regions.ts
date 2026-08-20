import { Router } from "express";
import { prisma } from "../db.js";
import { toRegionDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { findAccessibleWorld, getMemberWorldIds } from "../worldAccess.js";

export const regionsRouter = Router();

regionsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = {
    OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }],
    ...(worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.region.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toRegionDTO));
});

regionsRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.region.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
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

  const result = await prisma.region.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ error: "Region not found" });
  const row = await prisma.region.findUnique({ where: { id: req.params.id } });
  res.json(toRegionDTO(row!));
});

regionsRouter.delete("/:id", async (req, res) => {
  const result = await prisma.region.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Region not found" });
  await deleteLinksForEntity("region", req.params.id, req.userId!);
  res.status(204).end();
});
