import { Router } from "express";
import { prisma } from "../db.js";
import { toFactionDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { getMemberWorldIds } from "../worldAccess.js";

export const factionsRouter = Router();

factionsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = {
    OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }],
    ...(worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.faction.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toFactionDTO));
});

factionsRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.faction.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
  if (!row) return res.status(404).json({ error: "Faction not found" });
  res.json(toFactionDTO(row));
});

factionsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { name, factionType, agenda, methods, publicFace, hook, worldId, tags, notes, hiddenFromParty } = body;

  if (!name || !factionType || !agenda || !methods || !publicFace || !hook) {
    return res.status(400).json({ error: "Missing required faction fields" });
  }

  const row = await prisma.faction.create({
    data: {
      name, factionType, agenda, methods, publicFace, hook,
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
      hiddenFromParty: !!hiddenFromParty,
      userId: req.userId!,
    },
  });
  res.status(201).json(toFactionDTO(row));
});

factionsRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["name", "factionType", "agenda", "methods", "publicFace", "hook", "notes", "hiddenFromParty", "reputation"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("worldId" in body) data.worldId = body.worldId ?? null;
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  const result = await prisma.faction.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ error: "Faction not found" });
  const row = await prisma.faction.findUnique({ where: { id: req.params.id } });
  res.json(toFactionDTO(row!));
});

factionsRouter.delete("/:id", async (req, res) => {
  const result = await prisma.faction.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Faction not found" });
  await deleteLinksForEntity("faction", req.params.id, req.userId!);
  res.status(204).end();
});
