import { Router } from "express";
import { prisma } from "../db.js";
import { toAdventureDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { findAccessibleWorld, getMemberWorldIds, authorizeEntityWrite, listVisibleWhere, visibleEntityWhere } from "../worldAccess.js";

export const adventuresRouter = Router();

adventuresRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = listVisibleWhere(req.userId!, memberWorldIds, worldId);
  const rows = await prisma.adventure.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toAdventureDTO));
});

adventuresRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.adventure.findFirst({ where: { id: req.params.id, ...visibleEntityWhere(req.userId!, memberWorldIds) } });
  if (!row) return res.status(404).json({ error: "Adventure not found" });
  res.json(toAdventureDTO(row));
});

adventuresRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { title, tier, premise, hook, objective, complication, reward, worldId, tags, notes, hiddenFromParty } = body;

  if (!title || !tier || !premise || !hook || !objective || !complication || !reward) {
    return res.status(400).json({ error: "Missing required adventure fields" });
  }
  if (typeof worldId === "string") {
    const world = await findAccessibleWorld(req.userId!, worldId);
    if (!world) return res.status(403).json({ error: "You don't have access to this world" });
  }

  const row = await prisma.adventure.create({
    data: {
      title, tier, premise, hook, objective, complication, reward,
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
      hiddenFromParty: !!hiddenFromParty,
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
  if ("worldId" in body) {
    if (typeof body.worldId === "string") {
      const world = await findAccessibleWorld(req.userId!, body.worldId);
      if (!world) return res.status(403).json({ error: "You don't have access to this world" });
    }
    data.worldId = body.worldId ?? null;
  }
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  const existing = await prisma.adventure.findUnique({ where: { id: req.params.id } });
  if (!(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Adventure not found" });
  }
  const row = await prisma.adventure.update({ where: { id: req.params.id }, data });
  res.json(toAdventureDTO(row));
});

adventuresRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.adventure.findUnique({ where: { id: req.params.id } });
  if (!(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Adventure not found" });
  }
  await prisma.adventure.delete({ where: { id: req.params.id } });
  await deleteLinksForEntity("adventure", req.params.id, req.userId!);
  res.status(204).end();
});
