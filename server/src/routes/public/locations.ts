import { Router } from "express";
import { prisma } from "../../db.js";
import { toLocationDTO } from "../../serialize.js";

export const publicLocationsRouter = Router();

publicLocationsRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const where = {
    userId: req.userId,
    ...(typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.location.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  res.json(rows.map(toLocationDTO));
});

publicLocationsRouter.get("/:id", async (req, res) => {
  const row = await prisma.location.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!row) return res.status(404).json({ error: "Location not found" });
  res.json(toLocationDTO(row));
});
