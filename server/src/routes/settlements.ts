import { Router } from "express";
import { prisma } from "../db.js";
import { toSettlementDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { getMemberWorldIds } from "../worldAccess.js";

export const settlementsRouter = Router();

settlementsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = {
    OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }],
    ...(worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.settlement.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toSettlementDTO));
});

settlementsRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.settlement.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
  if (!row) return res.status(404).json({ error: "Settlement not found" });
  res.json(toSettlementDTO(row));
});

settlementsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { name, settlementType, population, government, description, regionId, worldId, tags, notes } = body;

  if (!name || !settlementType || !description) {
    return res.status(400).json({ error: "Missing required settlement fields" });
  }

  const row = await prisma.settlement.create({
    data: {
      name, settlementType, description,
      population: population ?? null,
      government: government ?? null,
      regionId: regionId ?? null,
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
      userId: req.userId!,
    },
  });
  res.status(201).json(toSettlementDTO(row));
});

settlementsRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["name", "settlementType", "description", "population", "government", "notes", "hiddenFromParty"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("worldId" in body) data.worldId = body.worldId ?? null;
  if ("regionId" in body) data.regionId = body.regionId ?? null;
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  const result = await prisma.settlement.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ error: "Settlement not found" });
  const row = await prisma.settlement.findUnique({ where: { id: req.params.id } });
  res.json(toSettlementDTO(row!));
});

settlementsRouter.delete("/:id", async (req, res) => {
  const result = await prisma.settlement.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Settlement not found" });
  await deleteLinksForEntity("settlement", req.params.id, req.userId!);
  res.status(204).end();
});
