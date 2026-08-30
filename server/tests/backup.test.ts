import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { resetDb } from "./resetDb.js";
import { buildExport, applyImport } from "../src/backup.js";

beforeEach(resetDb);
afterAll(async () => {
  await prisma.$disconnect();
});

async function signupAgent(username: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({ username, password: "password123" });
  return { agent, userId: res.body.id as string };
}

describe("backup export/import — full schema coverage", () => {
  it("remaps a dungeon room's linked battleMapId through the new BattleMap id", async () => {
    const { userId } = await signupAgent("backupdm1");
    const world = await prisma.world.create({ data: { name: "Remap World", userId } });
    const battleMap = await prisma.battleMap.create({ data: { name: "Crypt", width: 10, height: 10, worldId: world.id, userId } });
    await prisma.dungeon.create({
      data: {
        name: "Old Crypt", worldId: world.id, userId,
        rooms: JSON.stringify([{ id: "room1", name: "Entry", x: 0, y: 0, w: 3, h: 3, exits: [], battleMapId: battleMap.id }]),
      },
    });

    const bundle = await buildExport(userId, world.id, []);
    const result = await applyImport(userId, bundle);
    expect(result.worldsImported).toBe(1);

    const newWorld = await prisma.world.findFirst({ where: { userId, id: { not: world.id } } });
    const newBattleMap = await prisma.battleMap.findFirst({ where: { worldId: newWorld!.id } });
    const newDungeon = await prisma.dungeon.findFirst({ where: { worldId: newWorld!.id } });
    const rooms = JSON.parse(newDungeon!.rooms);
    expect(rooms[0].battleMapId).toBe(newBattleMap!.id);
    expect(rooms[0].battleMapId).not.toBe(battleMap.id);
  });

  it("remaps a combatant's playerCharacterId through the new PlayerCharacter id", async () => {
    const { userId } = await signupAgent("backupdm2");
    const world = await prisma.world.create({ data: { name: "Combat World", userId } });
    const pc = await prisma.playerCharacter.create({
      data: { name: "Vex", className: "Wizard", level: 1, race: "Elf", armorClass: 12, maxHp: 10, worldId: world.id, userId },
    });
    await prisma.encounter.create({
      data: {
        worldId: world.id,
        combatants: JSON.stringify([{
          id: "c1", name: "Vex", kind: "playerCharacter", initiative: 10, hpStatus: "healthy",
          conditions: [], notes: "", hpVisible: true, playerCharacterId: pc.id,
        }]),
      },
    });

    const bundle = await buildExport(userId, world.id, []);
    await applyImport(userId, bundle);

    const newWorld = await prisma.world.findFirst({ where: { userId, id: { not: world.id } } });
    const newPc = await prisma.playerCharacter.findFirst({ where: { worldId: newWorld!.id } });
    const newEncounter = await prisma.encounter.findFirst({ where: { worldId: newWorld!.id } });
    const combatants = JSON.parse(newEncounter!.combatants);
    expect(combatants[0].playerCharacterId).toBe(newPc!.id);
  });

  it("round-trips one representative row of every newly-covered model with correctly remapped references", async () => {
    const { userId } = await signupAgent("backupdm3");
    const world = await prisma.world.create({ data: { name: "Full World", userId, houseRules: '{"pointBuyBudget":30}', currentDay: 5 } });

    const region = await prisma.region.create({ data: { name: "The Reach", terrainCategory: "forest", description: "d", worldId: world.id, userId } });
    const faction = await prisma.faction.create({ data: { name: "The Circle", factionType: "cult", agenda: "a", methods: "m", publicFace: "p", hook: "h", worldId: world.id, userId } });
    const faction2 = await prisma.faction.create({ data: { name: "Rival", factionType: "guild", agenda: "a", methods: "m", publicFace: "p", hook: "h", worldId: world.id, userId } });
    const settlement = await prisma.settlement.create({ data: { name: "Millhaven", settlementType: "town", description: "d", regionId: region.id, controllingFactionId: faction.id, worldId: world.id, userId } });
    const character = await prisma.character.create({
      data: { kind: "npc", name: "Mira", alignment: "N", templateId: "t", templateName: "T", statBlock: "{}", backstory: "", factionId: faction.id, settlementId: settlement.id, worldId: world.id, userId },
    });
    const item = await prisma.item.create({ data: { name: "Torch", itemType: "gear", category: "adventuring", rarity: "common", description: "d", property: "p", history: "h", worldId: world.id, userId } });
    const shop = await prisma.shop.create({ data: { name: "The Anvil", stock: "[]", settlementId: settlement.id, worldId: world.id, userId } });
    await prisma.shopCommission.create({
      data: { worldId: world.id, shopId: shop.id, itemId: item.id, itemName: "Torch", price: 10, daysRequired: 1, characterName: "Vex", userId },
    });
    const base = await prisma.base.create({ data: { worldId: world.id } });
    await prisma.baseUpgrade.create({ data: { baseId: base.id, upgradeId: "watchtower", shopId: shop.id } });
    const questA = await prisma.questHook.create({ data: { title: "A", questType: "t", tier: "1", hook: "h", objective: "o", complication: "c", reward: "r", worldId: world.id, userId } });
    await prisma.questHook.create({ data: { title: "B", questType: "t", tier: "1", hook: "h", objective: "o", complication: "c", reward: "r", worldId: world.id, userId, prerequisiteQuestId: questA.id } });
    await prisma.factionRelationship.create({ data: { worldId: world.id, factionAId: faction.id, factionBId: faction2.id, stance: "rival", userId } });
    await prisma.factionLogEntry.create({ data: { factionId: faction.id, authorName: "DM", delta: 5, userId } });
    await prisma.dispositionLogEntry.create({ data: { characterId: character.id, authorName: "DM", delta: 3, userId } });
    await prisma.doomClock.create({ data: { worldId: world.id, label: "Doom", segments: 6, userId } });
    await prisma.triggerRule.create({ data: { worldId: world.id, name: "Rule", condition: "{}", message: "m", userId } });
    await prisma.campaignEvent.create({ data: { worldId: world.id, title: "Event", description: "d", factionId: faction.id, userId } });
    await prisma.worldTickLog.create({ data: { worldId: world.id, fromDay: 1, toDay: 2, itemCount: 1, userId } });
    await prisma.rollLogEntry.create({ data: { worldId: world.id, userId, rollerName: "DM", notation: "1d20", results: "[10]", total: 10 } });
    await prisma.chatMessage.create({ data: { worldId: world.id, userId, senderName: "DM", text: "hi" } });
    await prisma.downtimeActivity.create({ data: { worldId: world.id, userId, characterName: "Vex", activityType: "craft", description: "d", daysSpent: 1, craftedItemId: item.id } });
    await prisma.codexNote.create({ data: { worldId: world.id, userId, entityType: "character", entityId: character.id, authorName: "DM", text: "note" } });
    await prisma.ledgerEntry.create({ data: { worldId: world.id, userId, kind: "gain", label: "Loot", amount: 10, authorName: "DM", itemId: item.id } });
    await prisma.zoneMapTemplate.create({ data: { name: "Zones", zones: "[]", worldId: world.id, userId } });

    const bundle = await buildExport(userId, world.id, []);
    const result = await applyImport(userId, bundle);
    expect(result.worldsImported).toBe(1);

    const newWorld = await prisma.world.findFirst({ where: { userId, id: { not: world.id } } });
    expect(newWorld!.currentDay).toBe(5);
    expect(newWorld!.houseRules).toContain("pointBuyBudget");

    const newRegion = await prisma.region.findFirst({ where: { worldId: newWorld!.id } });
    const newSettlement = await prisma.settlement.findFirst({ where: { worldId: newWorld!.id } });
    const newFactions = await prisma.faction.findMany({ where: { worldId: newWorld!.id } });
    const newCircle = newFactions.find((f) => f.name === "The Circle")!;
    expect(newSettlement!.regionId).toBe(newRegion!.id);
    expect(newSettlement!.controllingFactionId).toBe(newCircle.id);

    const newCharacter = await prisma.character.findFirst({ where: { worldId: newWorld!.id } });
    expect(newCharacter!.factionId).toBe(newCircle.id);
    expect(newCharacter!.settlementId).toBe(newSettlement!.id);

    const newShop = await prisma.shop.findFirst({ where: { worldId: newWorld!.id } });
    const newItem = await prisma.item.findFirst({ where: { worldId: newWorld!.id } });
    const newCommission = await prisma.shopCommission.findFirst({ where: { worldId: newWorld!.id } });
    expect(newCommission!.shopId).toBe(newShop!.id);
    expect(newCommission!.itemId).toBe(newItem!.id);

    const newBase = await prisma.base.findFirst({ where: { worldId: newWorld!.id } });
    const newBaseUpgrade = await prisma.baseUpgrade.findFirst({ where: { baseId: newBase!.id } });
    expect(newBaseUpgrade!.shopId).toBe(newShop!.id);

    const newQuests = await prisma.questHook.findMany({ where: { worldId: newWorld!.id } });
    const newQuestA = newQuests.find((q) => q.title === "A")!;
    const newQuestB = newQuests.find((q) => q.title === "B")!;
    expect(newQuestB.prerequisiteQuestId).toBe(newQuestA.id);

    const newRelationships = await prisma.factionRelationship.findMany({ where: { worldId: newWorld!.id } });
    expect(newRelationships).toHaveLength(1);
    expect([newRelationships[0].factionAId, newRelationships[0].factionBId].sort()).toEqual(newFactions.map((f) => f.id).sort());

    expect(await prisma.factionLogEntry.count({ where: { factionId: { in: newFactions.map((f) => f.id) } } })).toBe(1);
    expect(await prisma.dispositionLogEntry.count({ where: { characterId: newCharacter!.id } })).toBe(1);
    expect(await prisma.doomClock.count({ where: { worldId: newWorld!.id } })).toBe(1);
    expect(await prisma.triggerRule.count({ where: { worldId: newWorld!.id } })).toBe(1);

    const newCampaignEvent = await prisma.campaignEvent.findFirst({ where: { worldId: newWorld!.id } });
    expect(newCampaignEvent!.factionId).toBe(newCircle.id);

    expect(await prisma.worldTickLog.count({ where: { worldId: newWorld!.id } })).toBe(1);
    expect(await prisma.rollLogEntry.count({ where: { worldId: newWorld!.id } })).toBe(1);
    expect(await prisma.chatMessage.count({ where: { worldId: newWorld!.id } })).toBe(1);

    const newDowntime = await prisma.downtimeActivity.findFirst({ where: { worldId: newWorld!.id } });
    expect(newDowntime!.craftedItemId).toBe(newItem!.id);

    // entityId is a polymorphic reference — intentionally left unremapped,
    // same accepted-orphan posture PublishedEntry/GuildJobClaim already take.
    const newCodexNote = await prisma.codexNote.findFirst({ where: { worldId: newWorld!.id } });
    expect(newCodexNote!.entityId).toBe(character.id);

    const newLedgerEntry = await prisma.ledgerEntry.findFirst({ where: { worldId: newWorld!.id } });
    expect(newLedgerEntry!.itemId).toBe(newItem!.id);

    expect(await prisma.zoneMapTemplate.count({ where: { worldId: newWorld!.id } })).toBe(1);
  });
});
