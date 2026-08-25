import { Router } from "express";
import { prisma } from "../../db.js";
import { toSessionNoteDTO } from "../../serialize.js";

export const publicSessionNotesRouter = Router();

publicSessionNotesRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const where = {
    userId: req.userId,
    ...(typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.sessionNote.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  res.json(rows.map((row) => toSessionNoteDTO(row, req.userId!)));
});

publicSessionNotesRouter.get("/:id", async (req, res) => {
  const row = await prisma.sessionNote.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!row) return res.status(404).json({ error: "Session note not found" });
  res.json(toSessionNoteDTO(row, req.userId!));
});
