import type { Character, Item, Location, QuestHook, Faction, EncounterTable, SessionNote, Link } from "@prisma/client";
import { prisma } from "./db.js";

export interface ExportBundle {
  version: 1;
  exportedAt: string;
  worlds: { id: string; name: string; description: string | null }[];
  characters: Character[];
  items: Item[];
  locations: Location[];
  quests: QuestHook[];
  factions: Faction[];
  encounterTables: EncounterTable[];
  sessionNotes: SessionNote[];
  links: Pick<Link, "fromType" | "fromId" | "toType" | "toId" | "label">[];
}

export async function buildExport(worldId?: string): Promise<ExportBundle> {
  const worlds = await prisma.world.findMany({ where: worldId ? { id: worldId } : {} });
  const scopeWhere = worldId ? { worldId } : {};

  const [characters, items, locations, quests, factions, encounterTables, sessionNotes] = await Promise.all([
    prisma.character.findMany({ where: scopeWhere }),
    prisma.item.findMany({ where: scopeWhere }),
    prisma.location.findMany({ where: scopeWhere }),
    prisma.questHook.findMany({ where: scopeWhere }),
    prisma.faction.findMany({ where: scopeWhere }),
    prisma.encounterTable.findMany({ where: scopeWhere }),
    prisma.sessionNote.findMany({ where: scopeWhere }),
  ]);

  const entityIds = new Set<string>([
    ...characters.map((c) => c.id), ...items.map((i) => i.id), ...locations.map((l) => l.id),
    ...quests.map((q) => q.id), ...factions.map((f) => f.id), ...encounterTables.map((e) => e.id),
    ...sessionNotes.map((n) => n.id),
  ]);

  const allLinks = await prisma.link.findMany();
  const links = allLinks.filter((l) => entityIds.has(l.fromId) && entityIds.has(l.toId));

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    worlds: worlds.map((w) => ({ id: w.id, name: w.name, description: w.description })),
    characters, items, locations, quests, factions, encounterTables, sessionNotes,
    links: links.map(({ fromType, fromId, toType, toId, label }) => ({ fromType, fromId, toType, toId, label })),
  };
}

export interface ImportResult {
  worldsImported: number;
  entitiesImported: number;
  linksImported: number;
}

export async function applyImport(bundle: ExportBundle): Promise<ImportResult> {
  return prisma.$transaction(async (tx) => {
    const worldIdMap = new Map<string, string>();
    const entityIdMap = new Map<string, string>();

    for (const w of bundle.worlds ?? []) {
      const created = await tx.world.create({ data: { name: w.name, description: w.description } });
      worldIdMap.set(w.id, created.id);
    }

    const remapWorldId = (oldWorldId: string | null) => (oldWorldId ? worldIdMap.get(oldWorldId) ?? null : null);

    for (const c of bundle.characters ?? []) {
      const created = await tx.character.create({
        data: {
          kind: c.kind, name: c.name, race: c.race, background: c.background, alignment: c.alignment,
          templateId: c.templateId, templateName: c.templateName, statBlock: c.statBlock, backstory: c.backstory,
          tags: c.tags, notes: c.notes, worldId: remapWorldId(c.worldId),
        },
      });
      entityIdMap.set(c.id, created.id);
    }

    for (const i of bundle.items ?? []) {
      const created = await tx.item.create({
        data: {
          name: i.name, itemType: i.itemType, category: i.category, rarity: i.rarity, description: i.description,
          property: i.property, history: i.history, tags: i.tags, notes: i.notes, worldId: remapWorldId(i.worldId),
        },
      });
      entityIdMap.set(i.id, created.id);
    }

    for (const l of bundle.locations ?? []) {
      const created = await tx.location.create({
        data: {
          name: l.name, locationType: l.locationType, category: l.category, description: l.description,
          notableFeature: l.notableFeature, keeper: l.keeper, rumor: l.rumor,
          tags: l.tags, notes: l.notes, worldId: remapWorldId(l.worldId),
        },
      });
      entityIdMap.set(l.id, created.id);
    }

    for (const q of bundle.quests ?? []) {
      const created = await tx.questHook.create({
        data: {
          title: q.title, questType: q.questType, tier: q.tier, hook: q.hook, objective: q.objective,
          complication: q.complication, reward: q.reward, tags: q.tags, notes: q.notes, worldId: remapWorldId(q.worldId),
        },
      });
      entityIdMap.set(q.id, created.id);
    }

    for (const f of bundle.factions ?? []) {
      const created = await tx.faction.create({
        data: {
          name: f.name, factionType: f.factionType, agenda: f.agenda, methods: f.methods,
          publicFace: f.publicFace, hook: f.hook, tags: f.tags, notes: f.notes, worldId: remapWorldId(f.worldId),
        },
      });
      entityIdMap.set(f.id, created.id);
    }

    for (const e of bundle.encounterTables ?? []) {
      const created = await tx.encounterTable.create({
        data: {
          name: e.name, terrain: e.terrain, entries: e.entries, tags: e.tags, notes: e.notes,
          worldId: remapWorldId(e.worldId),
        },
      });
      entityIdMap.set(e.id, created.id);
    }

    for (const n of bundle.sessionNotes ?? []) {
      const created = await tx.sessionNote.create({
        data: {
          title: n.title, sessionLabel: n.sessionLabel, summary: n.summary, looseThreads: n.looseThreads,
          nextSteps: n.nextSteps, tags: n.tags, notes: n.notes, worldId: remapWorldId(n.worldId),
        },
      });
      entityIdMap.set(n.id, created.id);
    }

    let linksImported = 0;
    for (const l of bundle.links ?? []) {
      const newFromId = entityIdMap.get(l.fromId);
      const newToId = entityIdMap.get(l.toId);
      if (!newFromId || !newToId) continue;
      await tx.link.create({ data: { fromType: l.fromType, fromId: newFromId, toType: l.toType, toId: newToId, label: l.label } });
      linksImported++;
    }

    return { worldsImported: worldIdMap.size, entitiesImported: entityIdMap.size, linksImported };
  });
}
