import { Router } from "express";
import { prisma } from "../../db.js";
import { toFactionDTO } from "../../serialize.js";

export const publicFactionsRouter = Router();

publicFactionsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const where = {
    userId: req.userId,
    ...(typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.faction.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  res.json(rows.map(toFactionDTO));
});

publicFactionsRouter.get("/:id", async (req, res) => {
  const row = await prisma.faction.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!row) return res.status(404).json({ error: "Faction not found" });
  res.json(toFactionDTO(row));
});
