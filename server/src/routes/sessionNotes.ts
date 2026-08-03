import { Router } from "express";
import { prisma } from "../db.js";
import { toSessionNoteDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";

export const sessionNotesRouter = Router();

sessionNotesRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const where = {
    userId: req.userId,
    ...(worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {}),
  };
  const rows = await prisma.sessionNote.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toSessionNoteDTO));
});

sessionNotesRouter.get("/:id", async (req, res) => {
  const row = await prisma.sessionNote.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!row) return res.status(404).json({ error: "Session note not found" });
  res.json(toSessionNoteDTO(row));
});

sessionNotesRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { title, sessionLabel, summary, looseThreads, nextSteps, worldId, tags, notes } = body;

  if (!title || !summary) {
    return res.status(400).json({ error: "Title and summary are required" });
  }

  const row = await prisma.sessionNote.create({
    data: {
      title, summary,
      sessionLabel: sessionLabel ?? null,
      looseThreads: looseThreads ?? null,
      nextSteps: nextSteps ?? null,
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
      userId: req.userId!,
    },
  });
  res.status(201).json(toSessionNoteDTO(row));
});

sessionNotesRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["title", "sessionLabel", "summary", "looseThreads", "nextSteps", "notes"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("worldId" in body) data.worldId = body.worldId ?? null;
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  const result = await prisma.sessionNote.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ error: "Session note not found" });
  const row = await prisma.sessionNote.findUnique({ where: { id: req.params.id } });
  res.json(toSessionNoteDTO(row!));
});

sessionNotesRouter.delete("/:id", async (req, res) => {
  const result = await prisma.sessionNote.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Session note not found" });
  await deleteLinksForEntity("sessionNote", req.params.id, req.userId!);
  res.status(204).end();
});
