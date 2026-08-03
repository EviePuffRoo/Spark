import { Router } from "express";
import { prisma } from "../db.js";
import { toLocationDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { getMemberWorldIds } from "../worldAccess.js";

export const locationsRouter = Router();

locationsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = {
    OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }],
    ...(worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.location.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toLocationDTO));
});

locationsRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.location.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
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
  if ("worldId" in body) data.worldId = body.worldId ?? null;
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  const result = await prisma.location.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ error: "Location not found" });
  const row = await prisma.location.findUnique({ where: { id: req.params.id } });
  res.json(toLocationDTO(row!));
});

locationsRouter.delete("/:id", async (req, res) => {
  const result = await prisma.location.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Location not found" });
  await deleteLinksForEntity("location", req.params.id, req.userId!);
  res.status(204).end();
});
