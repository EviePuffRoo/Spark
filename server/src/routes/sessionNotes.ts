import { Router } from "express";
import { prisma } from "../db.js";
import { toSessionNoteDTO } from "../serialize.js";
import { deleteLinksForEntity } from "../entityAdapters.js";
import { findAccessibleWorld, getMemberWorldIds, authorizeEntityWrite, listVisibleWhere, visibleEntityWhere } from "../worldAccess.js";

export const sessionNotesRouter = Router();

sessionNotesRouter.get("/", async (req, res) => {
  const { worldId } = req.query;
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const where = listVisibleWhere(req.userId!, memberWorldIds, worldId);
  const rows = await prisma.sessionNote.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(rows.map((row) => toSessionNoteDTO(row, req.userId!)));
});

sessionNotesRouter.get("/:id", async (req, res) => {
  const memberWorldIds = await getMemberWorldIds(req.userId!);
  const row = await prisma.sessionNote.findFirst({ where: { id: req.params.id, ...visibleEntityWhere(req.userId!, memberWorldIds) } });
  if (!row) return res.status(404).json({ error: "Session note not found" });
  res.json(toSessionNoteDTO(row, req.userId!));
});

sessionNotesRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { title, sessionLabel, sessionDate, summary, looseThreads, nextSteps, worldId, tags, notes, hiddenFromParty } = body;

  if (!title || !summary) {
    return res.status(400).json({ error: "Title and summary are required" });
  }
  if (typeof worldId === "string") {
    const world = await findAccessibleWorld(req.userId!, worldId);
    if (!world) return res.status(403).json({ error: "You don't have access to this world" });
  }

  const row = await prisma.sessionNote.create({
    data: {
      title, summary,
      sessionLabel: sessionLabel ?? null,
      sessionDate: sessionDate ? new Date(sessionDate) : null,
      looseThreads: looseThreads ?? null,
      nextSteps: nextSteps ?? null,
      worldId: worldId ?? null,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      notes: notes ?? null,
      hiddenFromParty: !!hiddenFromParty,
      userId: req.userId!,
    },
  });
  res.status(201).json(toSessionNoteDTO(row, req.userId!));
});

sessionNotesRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  for (const field of ["title", "sessionLabel", "summary", "looseThreads", "nextSteps", "notes", "hiddenFromParty"] as const) {
    if (field in body) data[field] = body[field];
  }
  if ("sessionDate" in body) data.sessionDate = body.sessionDate ? new Date(body.sessionDate) : null;
  if ("worldId" in body) {
    if (typeof body.worldId === "string") {
      const world = await findAccessibleWorld(req.userId!, body.worldId);
      if (!world) return res.status(403).json({ error: "You don't have access to this world" });
    }
    data.worldId = body.worldId ?? null;
  }
  if ("tags" in body) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  const existing = await prisma.sessionNote.findUnique({ where: { id: req.params.id } });
  if (!(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Session note not found" });
  }
  const row = await prisma.sessionNote.update({ where: { id: req.params.id }, data });
  res.json(toSessionNoteDTO(row, req.userId!));
});

sessionNotesRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.sessionNote.findUnique({ where: { id: req.params.id } });
  if (!(await authorizeEntityWrite(req.userId!, existing))) {
    return res.status(404).json({ error: "Session note not found" });
  }
  await prisma.sessionNote.delete({ where: { id: req.params.id } });
  await deleteLinksForEntity("sessionNote", req.params.id, req.userId!);
  res.status(204).end();
});
