import { prisma } from "./db.js";
import type { EntityType } from "@spark/shared";

interface EntityAdapter {
  findMany: (args: any) => Promise<any[]>;
  findUnique: (id: string, userId: string, memberWorldIds: string[]) => Promise<any>;
  getName: (row: any) => string;
  getMeta: (row: any) => string;
  searchFields: string[];
}

function buildSearchWhere(fields: string[], q: string) {
  return { OR: fields.map((field) => ({ [field]: { contains: q } })) };
}

function accessWhere(id: string, userId: string, memberWorldIds: string[]) {
  return { id, OR: [{ userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] };
}

const adapters: Record<EntityType, EntityAdapter> = {
  character: {
    findMany: (args) => prisma.character.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.character.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    getName: (row) => row.name,
    getMeta: (row) => `${row.kind === "npc" ? row.race ?? row.templateName : row.templateName} · CR ${JSON.parse(row.statBlock).challengeRating}`,
    searchFields: ["name", "race", "templateName", "background", "notes", "tags"],
  },
  item: {
    findMany: (args) => prisma.item.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.item.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    getName: (row) => row.name,
    getMeta: (row) => `${row.category} · ${row.rarity}`,
    searchFields: ["name", "itemType", "category", "description", "property", "history", "notes", "tags"],
  },
  location: {
    findMany: (args) => prisma.location.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.location.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    getName: (row) => row.name,
    getMeta: (row) => `${row.category} · ${row.locationType}`,
    searchFields: ["name", "locationType", "category", "description", "notableFeature", "keeper", "rumor", "notes", "tags"],
  },
  quest: {
    findMany: (args) => prisma.questHook.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.questHook.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    getName: (row) => row.title,
    getMeta: (row) => `${row.questType} · ${row.tier}`,
    searchFields: ["title", "questType", "tier", "hook", "objective", "complication", "reward", "notes", "tags"],
  },
  faction: {
    findMany: (args) => prisma.faction.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.faction.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    getName: (row) => row.name,
    getMeta: (row) => row.factionType,
    searchFields: ["name", "factionType", "agenda", "methods", "publicFace", "hook", "notes", "tags"],
  },
  encounterTable: {
    findMany: (args) => prisma.encounterTable.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.encounterTable.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    getName: (row) => row.name,
    getMeta: (row) => `${row.terrain} · d${JSON.parse(row.entries).length}`,
    searchFields: ["name", "terrain", "entries", "notes", "tags"],
  },
  sessionNote: {
    findMany: (args) => prisma.sessionNote.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.sessionNote.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    getName: (row) => row.title,
    getMeta: (row) => row.sessionLabel ?? "",
    searchFields: ["title", "sessionLabel", "summary", "looseThreads", "nextSteps", "notes", "tags"],
  },
  adventure: {
    findMany: (args) => prisma.adventure.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.adventure.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    getName: (row) => row.title,
    getMeta: (row) => row.tier,
    searchFields: ["title", "tier", "premise", "hook", "objective", "complication", "reward", "notes", "tags"],
  },
  playerCharacter: {
    findMany: (args) => prisma.playerCharacter.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.playerCharacter.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    getName: (row) => row.name,
    getMeta: (row) => `${row.className} ${row.level}`,
    searchFields: ["name", "className", "race", "playerName", "notes", "tags"],
  },
  zoneMapTemplate: {
    findMany: (args) => prisma.zoneMapTemplate.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.zoneMapTemplate.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    getName: (row) => row.name,
    getMeta: (row) => `${JSON.parse(row.zones).length} zones`,
    searchFields: ["name", "notes", "tags"],
  },
  dungeon: {
    findMany: (args) => prisma.dungeon.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.dungeon.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    getName: (row) => row.name,
    getMeta: (row) => `${JSON.parse(row.rooms).length} rooms`,
    searchFields: ["name", "notes", "tags"],
  },
  shop: {
    findMany: (args) => prisma.shop.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.shop.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    getName: (row) => row.name,
    getMeta: (row) => `${JSON.parse(row.stock).length} items in stock`,
    searchFields: ["name", "description", "notes", "tags"],
  },
};

export function getAdapter(type: string): EntityAdapter | null {
  return (adapters as Record<string, EntityAdapter>)[type] ?? null;
}

export function isEntityType(type: string): type is EntityType {
  return type in adapters;
}

export async function searchEntities(type: EntityType, q: string, userId: string, memberWorldIds: string[], take = 6) {
  const adapter = adapters[type];
  return adapter.findMany({
    where: {
      AND: [
        { OR: [{ userId }, { worldId: { in: memberWorldIds }, hiddenFromParty: false }] },
        buildSearchWhere(adapter.searchFields, q),
      ],
    },
    take,
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteLinksForEntity(type: EntityType, id: string, userId: string) {
  await prisma.link.deleteMany({ where: { userId, OR: [{ fromType: type, fromId: id }, { toType: type, toId: id }] } });
}
