import { Router } from "express";
import { prisma } from "../db.js";
import { toAdventureDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { getMemberWorldIds } from "../worldAccess.js";

export const adventuresRouter = Router();

adventuresRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = {
    OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }],
    ...(worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.adventure.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toAdventureDTO));
});

adventuresRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.adventure.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
  if (!row) return res.status(404).json({ error: "Adventure not found" });
  res.json(toAdventureDTO(row));
});

adventuresRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { title, tier, premise, hook, objective, complication, reward, worldId, tags, notes } = body;

  if (!title || !tier || !premise || !hook || !objective || !complication || !reward) {
    return res.status(400).json({ error: "Missing required adventure fields" });
  }

  const row = await prisma.adventure.create({
    data: {
      title, tier, premise, hook, objective, complication, reward,
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
      userId: req.userId!,
    },
  });
  res.status(201).json(toAdventureDTO(row));
});

adventuresRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["title", "tier", "premise", "hook", "objective", "complication", "reward", "notes", "hiddenFromParty"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("worldId" in body) data.worldId = body.worldId ?? null;
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  const result = await prisma.adventure.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ error: "Adventure not found" });
  const row = await prisma.adventure.findUnique({ where: { id: req.params.id } });
  res.json(toAdventureDTO(row!));
});

adventuresRouter.delete("/:id", async (req, res) => {
  const result = await prisma.adventure.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Adventure not found" });
  await deleteLinksForEntity("adventure", req.params.id, req.userId!);
  res.status(204).end();
});
