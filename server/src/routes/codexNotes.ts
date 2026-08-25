import { Router } from "express";
import { prisma } from "../db.js";
import { toCodexNoteDTO } from "../serialize.js";
import { getAdapter, isEntityType } from "../entityAdapters.js";
import { getMemberWorldIds, authorizeEntityWrite } from "../worldAccess.js";
import type { EntityType } from "@spark/shared";

export const codexNotesRouter = Router();

// A note can only ever be read or written for an entity the caller can
// already see — this reuses the exact same owner-or-member-with-
// hiddenFromParty-false access check as every other Roster entity, so a
// note can never leak (or attach to) something hidden from the party.
async function resolveEntity(userId: string, entityType: unknown, entityId: unknown) {
  if (typeof entityType !== "string" || typeof entityId !== "string" || !isEntityType(entityType)) return null;
  const memberWorldIds = await getMemberWorldIds(userId);
  const adapter = getAdapter(entityType);
  const row = adapter ? await adapter.findUnique(entityId, userId, memberWorldIds) : null;
  if (!row) return null;
  return { entityType: entityType as EntityType, entityId, worldId: (row.worldId as string | null) ?? null };
}

codexNotesRouter.get("/", async (req, res) => {
  const { entityType, entityId } = req.query;
  const entity = await resolveEntity(req.userId!, entityType, entityId);
  if (!entity) return res.status(404).json({ error: "Entity not found" });

  const rows = await prisma.codexNote.findMany({
    where: { entityType: entity.entityType, entityId: entity.entityId },
    orderBy: { createdAt: "asc" },
  });
  res.json(rows.map(toCodexNoteDTO));
});

codexNotesRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const { entityType, entityId, authorName, text } = body;
  if (typeof authorName !== "string" || !authorName.trim() || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "authorName and text are required" });
  }

  const entity = await resolveEntity(req.userId!, entityType, entityId);
  if (!entity) return res.status(404).json({ error: "Entity not found" });
  if (!entity.worldId) return res.status(400).json({ error: "This entry isn't assigned to a world" });

  const row = await prisma.codexNote.create({
    data: {
      worldId: entity.worldId,
      entityType: entity.entityType,
      entityId: entity.entityId,
      authorName: authorName.trim(),
      text: text.trim(),
      userId: req.userId!,
    },
  });
  res.status(201).json(toCodexNoteDTO(row));
});

codexNotesRouter.delete("/:id", async (req, res) => {
  const row = await prisma.codexNote.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Note not found" });

  if (!(await authorizeEntityWrite(req.userId!, row))) {
    return res.status(403).json({ error: "You can't delete this note" });
  }

  await prisma.codexNote.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
