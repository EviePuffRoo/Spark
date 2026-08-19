import { prisma } from "./db.js";
import { coerceZone } from "./routes/encounters.js";
import {
  generateCharacter, generateLocation, generateQuestHook, generateFaction,
  generateShop, generateEncounterTable, generatePlayerCharacter, generateDungeonOutline,
  layoutDungeonRooms,
} from "@spark/shared";
import type { DungeonRoom } from "@spark/shared";

// Builds a small, ready-to-explore sample world for a brand-new account so
// there's something to click around in before investing effort in a real
// campaign. Runs as one interactive transaction (not Promise.all) since the
// dungeon step depends on ZoneMapTemplate ids created earlier in the same
// run — a mid-sequence failure should roll back the whole bundle rather than
// leaving an orphaned partial world behind.
// Exported so anything that needs to identify a starter world after the
// fact (e.g. admin stats estimating onboarding adoption) uses this same
// constant instead of a second copy of the string that could drift.
export const STARTER_WORLD_NAME = "The Salt Coast";

export async function seedStarterWorld(userId: string): Promise<{ worldId: string }> {
  return prisma.$transaction(async (tx) => {
    const world = await tx.world.create({
      data: { name: STARTER_WORLD_NAME, description: "A sample world — a storm-battered fishing coast with a few hooks ready to pull on.", userId },
    });
    const worldId = world.id;

    for (let i = 0; i < 2; i++) {
      const npc = generateCharacter({ kind: "npc" });
      await tx.character.create({
        data: {
          kind: npc.kind, name: npc.name, race: npc.race ?? null, background: npc.background ?? null,
          alignment: npc.alignment, templateId: npc.templateId, templateName: npc.templateName,
          statBlock: JSON.stringify(npc.statBlock), backstory: JSON.stringify(npc.backstory),
          worldId, tags: JSON.stringify([]), notes: null, userId,
        },
      });
    }

    for (let i = 0; i < 3; i++) {
      const loc = generateLocation();
      await tx.location.create({
        data: {
          name: loc.name, locationType: loc.locationType, category: loc.category, description: loc.description,
          notableFeature: loc.notableFeature, keeper: loc.keeper, rumor: loc.rumor,
          worldId, settlementId: null, tags: JSON.stringify([]), notes: null, userId,
        },
      });
    }

    const quest = generateQuestHook();
    await tx.questHook.create({
      data: {
        title: quest.title, questType: quest.questType, tier: quest.tier, hook: quest.hook,
        objective: quest.objective, complication: quest.complication, reward: quest.reward,
        worldId, tags: JSON.stringify([]), notes: null, userId,
      },
    });

    const faction = generateFaction();
    await tx.faction.create({
      data: {
        name: faction.name, factionType: faction.factionType, agenda: faction.agenda, methods: faction.methods,
        publicFace: faction.publicFace, hook: faction.hook,
        worldId, tags: JSON.stringify([]), notes: null, userId,
      },
    });

    const shop = generateShop();
    await tx.shop.create({
      data: {
        name: shop.name, description: shop.description, stock: JSON.stringify(shop.stock),
        worldId, tags: JSON.stringify([]), notes: null, userId,
      },
    });

    const table = generateEncounterTable();
    await tx.encounterTable.create({
      data: {
        name: table.name, terrain: table.terrain, entries: JSON.stringify(table.entries),
        worldId, tags: JSON.stringify([]), notes: null, userId,
      },
    });

    for (let i = 0; i < 2; i++) {
      const pc = generatePlayerCharacter();
      await tx.playerCharacter.create({
        data: {
          name: pc.name, className: pc.className, level: pc.level, race: pc.race,
          armorClass: pc.armorClass, maxHp: pc.maxHp, currentHp: pc.maxHp,
          abilityScores: JSON.stringify(pc.abilityScores), playerName: pc.playerName ?? null,
          worldId, tags: JSON.stringify([]), notes: null,
          spellSlots: JSON.stringify(pc.spellSlots), classResources: JSON.stringify(pc.classResources),
          userId,
        },
      });
    }

    const outline = generateDungeonOutline();
    const laidOut = layoutDungeonRooms(outline.rooms.map((r) => ({ id: r.roomId, exits: r.exits })));
    const rectByRoomId = new Map(laidOut.map((r) => [r.id, r.rect]));

    const rooms: DungeonRoom[] = [];
    for (const room of outline.rooms) {
      const zone = coerceZone({
        id: room.zoneId, name: room.name, tags: [], x: 300, y: 200,
        connections: [], revealed: true, hazard: room.hazard,
      })!;
      const template = await tx.zoneMapTemplate.create({
        data: { name: room.name, zones: JSON.stringify([zone]), worldId, tags: JSON.stringify([]), notes: null, userId },
      });
      rooms.push({ id: room.roomId, name: room.name, templateId: template.id, exits: room.exits, rect: rectByRoomId.get(room.roomId) });
    }
    await tx.dungeon.create({
      data: { name: outline.name, rooms: JSON.stringify(rooms), worldId, tags: JSON.stringify([]), notes: null, userId },
    });

    return { worldId };
  });
}
