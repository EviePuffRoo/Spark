import { prisma } from "./db.js";
import type { EntityType } from "@spark/shared";

interface EntityAdapter {
  findMany: (args: any) => Promise<any[]>;
  findUnique: (id: string, userId: string, memberWorldIds: string[]) => Promise<any>;
  // Plain lookup by id with no ownership/membership check at all — gallery
  // entries are visible to every signed-in user regardless of who owns the
  // source row, which is deliberately broader than findUnique's access rule.
  findPublic: (id: string) => Promise<any>;
  // Server-side generalization of RosterPage.tsx's per-type client
  // "Duplicate" handler: copies the row's own fields onto a new one owned by
  // targetUserId. Every type but Dungeon can share one generic
  // field-spread implementation (see genericDuplicate below).
  duplicate: (row: any, targetUserId: string, targetWorldId: string | null) => Promise<{ id: string }>;
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

// Every entity's DB row carries the same identity/ownership/timestamp
// fields on top of its own type-specific columns — strip those and hand
// the rest straight to `create`, overriding ownership onto the new owner.
const CLONE_EXCLUDED_FIELDS = new Set(["id", "userId", "worldId", "hiddenFromParty", "createdAt", "updatedAt"]);

function genericDuplicate(model: { create: (args: { data: any }) => Promise<any> }) {
  return async (row: any, targetUserId: string, targetWorldId: string | null) => {
    const data: Record<string, unknown> = { userId: targetUserId, worldId: targetWorldId, hiddenFromParty: false };
    for (const [key, value] of Object.entries(row)) {
      if (!CLONE_EXCLUDED_FIELDS.has(key)) data[key] = value;
    }
    return model.create({ data });
  };
}

// Dungeon.rooms references ZoneMapTemplate ids the cloning user doesn't own
// (or, cloning within the same account, that are already used by the
// original dungeon) — genericDuplicate can't just carry the JSON over
// as-is. Clone each referenced template first, then rewrite `rooms` to
// point at the new template ids before creating the Dungeon row.
async function duplicateDungeon(row: any, targetUserId: string, targetWorldId: string | null) {
  const rooms = JSON.parse(row.rooms) as { templateId: string }[];
  const templateIdMap = new Map<string, string>();
  for (const room of rooms) {
    if (templateIdMap.has(room.templateId)) continue;
    const template = await prisma.zoneMapTemplate.findUnique({ where: { id: room.templateId } });
    if (!template) continue;
    const cloned = await genericDuplicate(prisma.zoneMapTemplate)(template, targetUserId, targetWorldId);
    templateIdMap.set(room.templateId, cloned.id);
  }
  const rewrittenRooms = rooms.map((room) => ({ ...room, templateId: templateIdMap.get(room.templateId) ?? room.templateId }));

  const data: Record<string, unknown> = { userId: targetUserId, worldId: targetWorldId, hiddenFromParty: false };
  for (const [key, value] of Object.entries(row)) {
    if (!CLONE_EXCLUDED_FIELDS.has(key) && key !== "rooms") data[key] = value;
  }
  data.rooms = JSON.stringify(rewrittenRooms);
  return prisma.dungeon.create({ data: data as any });
}

const adapters: Record<EntityType, EntityAdapter> = {
  character: {
    findMany: (args) => prisma.character.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.character.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    findPublic: (id) => prisma.character.findUnique({ where: { id } }),
    duplicate: genericDuplicate(prisma.character),
    getName: (row) => row.name,
    getMeta: (row) => `${row.kind === "npc" ? row.race ?? row.templateName : row.templateName} · CR ${JSON.parse(row.statBlock).challengeRating}`,
    searchFields: ["name", "race", "templateName", "background", "notes", "tags"],
  },
  item: {
    findMany: (args) => prisma.item.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.item.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    findPublic: (id) => prisma.item.findUnique({ where: { id } }),
    duplicate: genericDuplicate(prisma.item),
    getName: (row) => row.name,
    getMeta: (row) => `${row.category} · ${row.rarity}`,
    searchFields: ["name", "itemType", "category", "description", "property", "history", "notes", "tags"],
  },
  location: {
    findMany: (args) => prisma.location.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.location.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    findPublic: (id) => prisma.location.findUnique({ where: { id } }),
    duplicate: genericDuplicate(prisma.location),
    getName: (row) => row.name,
    getMeta: (row) => `${row.category} · ${row.locationType}`,
    searchFields: ["name", "locationType", "category", "description", "notableFeature", "keeper", "rumor", "notes", "tags"],
  },
  quest: {
    findMany: (args) => prisma.questHook.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.questHook.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    findPublic: (id) => prisma.questHook.findUnique({ where: { id } }),
    duplicate: genericDuplicate(prisma.questHook),
    getName: (row) => row.title,
    getMeta: (row) => `${row.questType} · ${row.tier}`,
    searchFields: ["title", "questType", "tier", "hook", "objective", "complication", "reward", "notes", "tags"],
  },
  faction: {
    findMany: (args) => prisma.faction.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.faction.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    findPublic: (id) => prisma.faction.findUnique({ where: { id } }),
    duplicate: genericDuplicate(prisma.faction),
    getName: (row) => row.name,
    getMeta: (row) => row.factionType,
    searchFields: ["name", "factionType", "agenda", "methods", "publicFace", "hook", "notes", "tags"],
  },
  encounterTable: {
    findMany: (args) => prisma.encounterTable.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.encounterTable.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    findPublic: (id) => prisma.encounterTable.findUnique({ where: { id } }),
    duplicate: genericDuplicate(prisma.encounterTable),
    getName: (row) => row.name,
    getMeta: (row) => `${row.terrain} · d${JSON.parse(row.entries).length}`,
    searchFields: ["name", "terrain", "entries", "notes", "tags"],
  },
  sessionNote: {
    findMany: (args) => prisma.sessionNote.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.sessionNote.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    findPublic: (id) => prisma.sessionNote.findUnique({ where: { id } }),
    duplicate: genericDuplicate(prisma.sessionNote),
    getName: (row) => row.title,
    getMeta: (row) => row.sessionLabel ?? "",
    searchFields: ["title", "sessionLabel", "summary", "looseThreads", "nextSteps", "notes", "tags"],
  },
  adventure: {
    findMany: (args) => prisma.adventure.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.adventure.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    findPublic: (id) => prisma.adventure.findUnique({ where: { id } }),
    duplicate: genericDuplicate(prisma.adventure),
    getName: (row) => row.title,
    getMeta: (row) => row.tier,
    searchFields: ["title", "tier", "premise", "hook", "objective", "complication", "reward", "notes", "tags"],
  },
  playerCharacter: {
    findMany: (args) => prisma.playerCharacter.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.playerCharacter.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    findPublic: (id) => prisma.playerCharacter.findUnique({ where: { id } }),
    duplicate: genericDuplicate(prisma.playerCharacter),
    getName: (row) => row.name,
    getMeta: (row) => `${row.className} ${row.level}`,
    searchFields: ["name", "className", "race", "playerName", "notes", "tags"],
  },
  zoneMapTemplate: {
    findMany: (args) => prisma.zoneMapTemplate.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.zoneMapTemplate.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    findPublic: (id) => prisma.zoneMapTemplate.findUnique({ where: { id } }),
    duplicate: genericDuplicate(prisma.zoneMapTemplate),
    getName: (row) => row.name,
    getMeta: (row) => `${JSON.parse(row.zones).length} zones`,
    searchFields: ["name", "notes", "tags"],
  },
  dungeon: {
    findMany: (args) => prisma.dungeon.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.dungeon.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    findPublic: (id) => prisma.dungeon.findUnique({ where: { id } }),
    duplicate: duplicateDungeon,
    getName: (row) => row.name,
    getMeta: (row) => `${JSON.parse(row.rooms).length} rooms`,
    searchFields: ["name", "notes", "tags"],
  },
  shop: {
    findMany: (args) => prisma.shop.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.shop.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    findPublic: (id) => prisma.shop.findUnique({ where: { id } }),
    duplicate: genericDuplicate(prisma.shop),
    getName: (row) => row.name,
    getMeta: (row) => `${JSON.parse(row.stock).length} items in stock`,
    searchFields: ["name", "description", "notes", "tags"],
  },
  region: {
    findMany: (args) => prisma.region.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.region.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    findPublic: (id) => prisma.region.findUnique({ where: { id } }),
    duplicate: genericDuplicate(prisma.region),
    getName: (row) => row.name,
    getMeta: (row) => `${row.terrainCategory}${row.dangerLevel ? ` · ${row.dangerLevel}` : ""}`,
    searchFields: ["name", "terrainCategory", "dangerLevel", "description", "notes", "tags"],
  },
  settlement: {
    findMany: (args) => prisma.settlement.findMany(args),
    findUnique: (id, userId, memberWorldIds) => prisma.settlement.findFirst({ where: accessWhere(id, userId, memberWorldIds) }),
    findPublic: (id) => prisma.settlement.findUnique({ where: { id } }),
    duplicate: genericDuplicate(prisma.settlement),
    getName: (row) => row.name,
    getMeta: (row) => row.settlementType,
    searchFields: ["name", "settlementType", "government", "description", "notes", "tags"],
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
