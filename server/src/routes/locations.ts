import { Router } from "express";
import { prisma } from "../db.js";
import { toLocationDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { findAccessibleWorld, getMemberWorldIds, authorizeEntityWrite, listVisibleWhere, visibleEntityWhere } from "../worldAccess.js";

export const locationsRouter = Router();

locationsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = listVisibleWhere(req.userId!, memberWorldIds, worldId);
  const rows = await prisma.location.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toLocationDTO));
});

locationsRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.location.findFirst({ where: { id: req.params.id, ...visibleEntityWhere(req.userId!, memberWorldIds) } });
  if (!row) return res.status(404).json({ error: "Location not found" });
  res.json(toLocationDTO(row));
});

locationsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { name, locationType, category, description, notableFeature, keeper, rumor, worldId, tags, notes, settlementId, hiddenFromParty } = body;

  if (!name || !locationType || !category || !description || !notableFeature || !keeper || !rumor) {
    return res.status(400).json({ error: "Missing required location fields" });
  }
  if (typeof worldId === "string") {
    const world = await findAccessibleWorld(req.userId!, worldId);
    if (!world) return res.status(403).json({ error: "You don't have access to this world" });
  }

  const row = await prisma.location.create({
    data: {
      name, locationType, category, description, notableFeature, keeper, rumor,
      worldId: worldId ?? null,
      settlementId: settlementId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
      hiddenFromParty: !!hiddenFromParty,
      userId: req.userId!,
    },
  });
  res.status(201).json(toLocationDTO(row));
});

locationsRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["name", "locationType", "category", "description", "notableFeature", "keeper", "rumor", "notes", "hiddenFromParty"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("worldId" in body) {
    if (typeof body.worldId === "string") {
      const world = await findAccessibleWorld(req.userId!, body.worldId);
      if (!world) return res.status(403).json({ error: "You don't have access to this world" });
    }
    data.worldId = body.worldId ?? null;
  }
  if ("settlementId" in body) data.settlementId = body.settlementId ?? null;
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  const existing = await prisma.location.findUnique({ where: { id: req.params.id } });
  if (!(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Location not found" });
  }
  const row = await prisma.location.update({ where: { id: req.params.id }, data });
  res.json(toLocationDTO(row));
});

locationsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.location.findUnique({ where: { id: req.params.id } });
  if (!(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Location not found" });
  }
  await prisma.location.delete({ where: { id: req.params.id } });
  await deleteLinksForEntity("location", req.params.id, req.userId!);
  res.status(204).end();
});
