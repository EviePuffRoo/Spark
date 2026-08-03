import { prisma } from "./db.js";
import type { EntityType } from "@spark/shared";

interface EntityAdapter {
  findMany: (args: Record<string, unknown>) => Promise<any[]>;
  findUnique: (id: string) => Promise<any>;
  getName: (row: any) => string;
  getMeta: (row: any) => string;
  searchFields: string[];
}

function buildSearchWhere(fields: string[], q: string) {
  return { OR: fields.map((field) => ({ [field]: { contains: q } })) };
}

const adapters: Record<EntityType, EntityAdapter> = {
  character: {
    findMany: (args) => prisma.character.findMany(args),
    findUnique: (id) => prisma.character.findUnique({ where: { id } }),
    getName: (row) => row.name,
    getMeta: (row) => `${row.kind === "npc" ? row.race ?? row.templateName : row.templateName} · CR ${JSON.parse(row.statBlock).challengeRating}`,
    searchFields: ["name", "race", "templateName", "background", "notes", "tags"],
  },
  item: {
    findMany: (args) => prisma.item.findMany(args),
    findUnique: (id) => prisma.item.findUnique({ where: { id } }),
    getName: (row) => row.name,
    getMeta: (row) => `${row.category} · ${row.rarity}`,
    searchFields: ["name", "itemType", "category", "description", "property", "history", "notes", "tags"],
  },
  location: {
    findMany: (args) => prisma.location.findMany(args),
    findUnique: (id) => prisma.location.findUnique({ where: { id } }),
    getName: (row) => row.name,
    getMeta: (row) => `${row.category} · ${row.locationType}`,
    searchFields: ["name", "locationType", "category", "description", "notableFeature", "keeper", "rumor", "notes", "tags"],
  },
  quest: {
    findMany: (args) => prisma.questHook.findMany(args),
    findUnique: (id) => prisma.questHook.findUnique({ where: { id } }),
    getName: (row) => row.title,
    getMeta: (row) => `${row.questType} · ${row.tier}`,
    searchFields: ["title", "questType", "tier", "hook", "objective", "complication", "reward", "notes", "tags"],
  },
  faction: {
    findMany: (args) => prisma.faction.findMany(args),
    findUnique: (id) => prisma.faction.findUnique({ where: { id } }),
    getName: (row) => row.name,
    getMeta: (row) => row.factionType,
    searchFields: ["name", "factionType", "agenda", "methods", "publicFace", "hook", "notes", "tags"],
  },
  encounterTable: {
    findMany: (args) => prisma.encounterTable.findMany(args),
    findUnique: (id) => prisma.encounterTable.findUnique({ where: { id } }),
    getName: (row) => row.name,
    getMeta: (row) => `${row.terrain} · d${JSON.parse(row.entries).length}`,
    searchFields: ["name", "terrain", "entries", "notes", "tags"],
  },
  sessionNote: {
    findMany: (args) => prisma.sessionNote.findMany(args),
    findUnique: (id) => prisma.sessionNote.findUnique({ where: { id } }),
    getName: (row) => row.title,
    getMeta: (row) => row.sessionLabel ?? "",
    searchFields: ["title", "sessionLabel", "summary", "looseThreads", "nextSteps", "notes", "tags"],
  },
};

export function getAdapter(type: string): EntityAdapter | null {
  return (adapters as Record<string, EntityAdapter>)[type] ?? null;
}

export function isEntityType(type: string): type is EntityType {
  return type in adapters;
}

export async function searchEntities(type: EntityType, q: string, take = 6) {
  const adapter = adapters[type];
  return adapter.findMany({ where: buildSearchWhere(adapter.searchFields, q), take, orderBy: { createdAt: "desc" } });
}

export async function deleteLinksForEntity(type: EntityType, id: string) {
  await prisma.link.deleteMany({ where: { OR: [{ fromType: type, fromId: id }, { toType: type, toId: id }] } });
}
