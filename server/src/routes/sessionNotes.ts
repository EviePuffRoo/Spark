import { Router } from "express";
import { prisma } from "../db.js";
import { toSessionNoteDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";

export const sessionNotesRouter = Router();

sessionNotesRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const where =
    worldId === "unassigned" ? { worldId: null } : typeof worldId === "string" ? { worldId } : {};
  const rows = await prisma.sessionNote.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map(toSessionNoteDTO));
});

sessionNotesRouter.get("/:id", async (req, res) => {
  const row = await prisma.sessionNote.findUnique({ where: { id: req.params.id } });
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

  try {
    const row = await prisma.sessionNote.update({ where: { id: req.params.id }, data });
    res.json(toSessionNoteDTO(row));
  } catch {
    res.status(404).json({ error: "Session note not found" });
  }
});

sessionNotesRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.sessionNote.delete({ where: { id: req.params.id } });
    await deleteLinksForEntity("sessionNote", req.params.id);
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Session note not found" });
  }
});
