import { Router } from "express";
import { prisma } from "../db.js";
import { toQuestHookDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { findAccessibleWorld, getMemberWorldIds } from "../worldAccess.js";

export const questsRouter = Router();

questsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = {
    OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }],
    ...(worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.questHook.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toQuestHookDTO));
});

questsRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.questHook.findFirst({ where: { id: req.params.id, OR: [{ userId: req.userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] } });
  if (!row) return res.status(404).json({ error: "Quest hook not found" });
  res.json(toQuestHookDTO(row));
});

questsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { title, questType, tier, hook, objective, complication, reward, worldId, tags, notes, hiddenFromParty } = body;

  if (!title || !questType || !tier || !hook || !objective || !complication || !reward) {
    return res.status(400).json({ error: "Missing required quest hook fields" });
  }
  if (typeof worldId === "string") {
    const world = await findAccessibleWorld(req.userId!, worldId);
    if (!world) return res.status(403).json({ error: "You don't have access to this world" });
  }

  const row = await prisma.questHook.create({
    data: {
      title, questType, tier, hook, objective, complication, reward,
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
      hiddenFromParty: !!hiddenFromParty,
      userId: req.userId!,
    },
  });
  res.status(201).json(toQuestHookDTO(row));
});

questsRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["title", "questType", "tier", "hook", "objective", "complication", "reward", "status", "notes", "hiddenFromParty"] as const) {
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

  const result = await prisma.questHook.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ error: "Quest hook not found" });
  const row = await prisma.questHook.findUnique({ where: { id: req.params.id } });
  res.json(toQuestHookDTO(row!));
});

questsRouter.delete("/:id", async (req, res) => {
  const result = await prisma.questHook.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Quest hook not found" });
  await deleteLinksForEntity("quest", req.params.id, req.userId!);
  res.status(204).end();
});
