import { Router } from "express";
import { prisma } from "../../db.js";
import { toQuestHookDTO } from "../../serialize.js";

export const publicQuestsRouter = Router();

publicQuestsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const where = {
    userId: req.userId,
    ...(typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.questHook.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  res.json(rows.map(toQuestHookDTO));
});

publicQuestsRouter.get("/:id", async (req, res) => {
  const row = await prisma.questHook.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!row) return res.status(404).json({ error: "Quest not found" });
  res.json(toQuestHookDTO(row));
});
