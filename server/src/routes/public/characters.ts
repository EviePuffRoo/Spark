import { Router } from "express";
import { prisma } from "../../db.js";
import { toCharacterDTO } from "../../serialize.js";

export const publicCharactersRouter = Router();

publicCharactersRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const where = {
    userId: req.userId,
    ...(typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.character.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  res.json(rows.map(toCharacterDTO));
});

publicCharactersRouter.get("/:id", async (req, res) => {
  const row = await prisma.character.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!row) return res.status(404).json({ error: "Character not found" });
  res.json(toCharacterDTO(row));
});
