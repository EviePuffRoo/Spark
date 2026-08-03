import { Router } from "express";
import { prisma } from "../db.js";
import { toQuestHookDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";

export const questsRouter = Router();

questsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const where =
    worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {};
  const rows = await prisma.questHook.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toQuestHookDTO));
});

questsRouter.get("/:id", async (req, res) => {
  const row = await prisma.questHook.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Quest hook not found" });
  res.json(toQuestHookDTO(row));
});

questsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { title, questType, tier, hook, objective, complication, reward, worldId, tags, notes } = body;

  if (!title || !questType || !tier || !hook || !objective || !complication || !reward) {
    return res.status(400).json({ error: "Missing required quest hook fields" });
  }

  const row = await prisma.questHook.create({
    data: {
      title, questType, tier, hook, objective, complication, reward,
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
    },
  });
  res.status(201).json(toQuestHookDTO(row));
});

questsRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["title", "questType", "tier", "hook", "objective", "complication", "reward", "notes"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("worldId" in body) data.worldId = body.worldId ?? null;
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  try {
    const row = await prisma.questHook.update({ where: { id: req.params.id }, data });
    res.json(toQuestHookDTO(row));
  } catch {
    res.status(404).json({ error: "Quest hook not found" });
  }
});

questsRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.questHook.delete({ where: { id: req.params.id } });
    await deleteLinksForEntity("quest", req.params.id);
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Quest hook not found" });
  }
});
