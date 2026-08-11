import { Router } from "express";
import { prisma } from "../db.js";
import { getAdapter, isEntityType } from "../entityAdapters.js";
import {
  toCharacterDTO, toItemDTO, toLocationDTO, toQuestHookDTO, toFactionDTO, toEncounterTableDTO,
  toSessionNoteDTO, toAdventureDTO, toPlayerCharacterDTO, toZoneMapTemplateDTO, toDungeonDTO,
  toShopDTO, toRegionDTO, toSettlementDTO,
} from "../serialize.js";
import type { EntityType, PublicGalleryEntry } from "@spark/shared";

export const publicGalleryRouter = Router();

const PAGE_SIZE = 20;

// Reuses the exact same DTO shape each entity's own GET route returns, so
// the client can render a published entry with the same card components
// RosterPage already uses for a non-owner viewer, without a second set of
// view components just for the gallery.
function toEntityDTO(entityType: EntityType, row: any, viewerId: string): unknown {
  switch (entityType) {
    case "character": return toCharacterDTO(row);
    case "item": return toItemDTO(row);
    case "location": return toLocationDTO(row);
    case "quest": return toQuestHookDTO(row);
    case "faction": return toFactionDTO(row);
    case "encounterTable": return toEncounterTableDTO(row);
    case "sessionNote": return toSessionNoteDTO(row, viewerId);
    case "adventure": return toAdventureDTO(row);
    case "playerCharacter": return toPlayerCharacterDTO(row);
    case "zoneMapTemplate": return toZoneMapTemplateDTO(row);
    case "dungeon": return toDungeonDTO(row);
    case "shop": return toShopDTO(row);
    case "region": return toRegionDTO(row);
    case "settlement": return toSettlementDTO(row);
    default: return null;
  }
}

publicGalleryRouter.get("/", async (req, res) => {
  const { entityType, cursor } = req.query;
  const typeFilter = typeof entityType === "string" && isEntityType(entityType) ? entityType : undefined;

  const rows = await prisma.publishedEntry.findMany({
    where: typeFilter ? { entityType: typeFilter } : undefined,
    orderBy: { publishedAt: "desc" },
    ...(typeof cursor === "string" ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: PAGE_SIZE + 1,
    include: { user: { select: { username: true } } },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);

  const entries: PublicGalleryEntry[] = [];
  for (const row of page) {
    const adapter = getAdapter(row.entityType);
    if (!adapter) continue;
    // Orphaned entry — its source row was deleted since publishing. Skip
    // rather than surface a broken gallery card; no cleanup pass runs
    // against these, so this check is what keeps them invisible.
    const sourceRow = await adapter.findPublic(row.entityId);
    if (!sourceRow) continue;
    entries.push({
      id: row.id,
      entityType: row.entityType as PublicGalleryEntry["entityType"],
      entityId: row.entityId,
      title: row.title,
      description: row.description ?? undefined,
      name: adapter.getName(sourceRow),
      meta: adapter.getMeta(sourceRow),
      publisherUsername: row.user.username,
      publishedAt: row.publishedAt.toISOString(),
    });
  }

  res.json({ entries, nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null });
});

publicGalleryRouter.get("/:id", async (req, res) => {
  const entry = await prisma.publishedEntry.findUnique({ where: { id: req.params.id }, include: { user: { select: { username: true } } } });
  if (!entry) return res.status(404).json({ error: "Published entry not found" });

  const adapter = getAdapter(entry.entityType);
  if (!adapter) return res.status(400).json({ error: "Unknown entity type" });

  const sourceRow = await adapter.findPublic(entry.entityId);
  if (!sourceRow) return res.status(404).json({ error: "The original entry has been deleted" });

  res.json({
    id: entry.id,
    entityType: entry.entityType,
    entityId: entry.entityId,
    title: entry.title,
    description: entry.description ?? undefined,
    publisherUsername: entry.user.username,
    publishedAt: entry.publishedAt.toISOString(),
    data: toEntityDTO(entry.entityType as EntityType, sourceRow, req.userId!),
  });
});

publicGalleryRouter.post("/", async (req, res) => {
  const { entityType, entityId, title, description } = req.body ?? {};
  if (!isEntityType(entityType) || typeof entityId !== "string" || !title) {
    return res.status(400).json({ error: "entityType, entityId, and title are required" });
  }

  const adapter = getAdapter(entityType);
  if (!adapter) return res.status(400).json({ error: "Unknown entity type" });

  // Empty memberWorldIds means findUnique's access clause can only match
  // via true ownership — this is a "do you own this" check, not the
  // broader "can you view this" check the same adapter method answers
  // elsewhere in the app.
  const row = await adapter.findUnique(entityId, req.userId!, []);
  if (!row || row.userId !== req.userId) {
    return res.status(403).json({ error: "You can only publish entities you own" });
  }

  const entry = await prisma.publishedEntry.create({
    data: { entityType, entityId, userId: req.userId!, title, description: description || null },
  });
  res.status(201).json({ id: entry.id });
});

publicGalleryRouter.delete("/:id", async (req, res) => {
  const result = await prisma.publishedEntry.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (result.count === 0) return res.status(404).json({ error: "Published entry not found" });
  res.status(204).end();
});

publicGalleryRouter.post("/:id/clone", async (req, res) => {
  const entry = await prisma.publishedEntry.findUnique({ where: { id: req.params.id } });
  if (!entry) return res.status(404).json({ error: "Published entry not found" });

  const adapter = getAdapter(entry.entityType);
  if (!adapter) return res.status(400).json({ error: "Unknown entity type" });

  const sourceRow = await adapter.findPublic(entry.entityId);
  if (!sourceRow) return res.status(404).json({ error: "The original entry has been deleted" });

  // Clones land unassigned to any world, same default as a manually
  // created entity.
  const cloned = await adapter.duplicate(sourceRow, req.userId!, null);
  res.status(201).json({ id: cloned.id });
});
