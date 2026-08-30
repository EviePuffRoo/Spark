import type {
  Character, Item, Location, QuestHook, Faction, EncounterTable, SessionNote, Adventure, PlayerCharacter, Link,
  Region, Settlement, Shop, ShopCommission, ZoneMapTemplate, Dungeon, BattleMap, Base, BaseUpgrade,
  DoomClock, TriggerRule, CampaignEvent, CampaignEventLog, WorldTickLog, RollLogEntry, ChatMessage,
  DowntimeActivity, CodexNote, LedgerEntry, Encounter, FactionRelationship, FactionLogEntry, DispositionLogEntry,
} from "@prisma/client";
import type { DungeonRoom, LiveCombatant } from "@spark/shared";
import { prisma } from "./db.js";

export interface ExportBundle {
  version: 1;
  exportedAt: string;
  worlds: { id: string; name: string; description: string | null; houseRules: string; currentDay: number; nextSessionAt: string | null }[];
  characters: Character[];
  items: Item[];
  locations: Location[];
  quests: QuestHook[];
  factions: Faction[];
  encounterTables: EncounterTable[];
  sessionNotes: SessionNote[];
  adventures: Adventure[];
  playerCharacters: PlayerCharacter[];
  regions: Region[];
  settlements: Settlement[];
  shops: Shop[];
  shopCommissions: ShopCommission[];
  zoneMapTemplates: ZoneMapTemplate[];
  dungeons: Dungeon[];
  battleMaps: BattleMap[];
  bases: Base[];
  baseUpgrades: BaseUpgrade[];
  doomClocks: DoomClock[];
  triggerRules: TriggerRule[];
  campaignEvents: CampaignEvent[];
  campaignEventLogs: CampaignEventLog[];
  worldTickLogs: WorldTickLog[];
  rollLogEntries: RollLogEntry[];
  chatMessages: ChatMessage[];
  downtimeActivities: DowntimeActivity[];
  codexNotes: CodexNote[];
  ledgerEntries: LedgerEntry[];
  encounters: Encounter[];
  factionRelationships: FactionRelationship[];
  factionLogEntries: FactionLogEntry[];
  dispositionLogEntries: DispositionLogEntry[];
  links: Pick<Link, "fromType" | "fromId" | "toType" | "toId" | "label">[];
}

// A world export additionally allows a shared-world member (not just the
// owner) to export the whole world's content, matching their normal
// read access — but the account-wide export (no worldId) always stays
// owner-only, since silently folding someone else's shared campaign into
// "export everything" would be surprising.
export async function buildExport(userId: string, worldId: string | undefined, memberWorldIds: string[]): Promise<ExportBundle> {
  const hasSharedAccess = !!worldId && memberWorldIds.includes(worldId);
  const worldsWhere = worldId
    ? (hasSharedAccess ? { id: worldId } : { id: worldId, userId })
    : { userId };
  const scopeWhere = worldId
    ? (hasSharedAccess ? { worldId } : { worldId, userId })
    : { userId };

  const worlds = await prisma.world.findMany({ where: worldsWhere });
  const worldIds = worlds.map((w) => w.id);

  const [
    characters, items, locations, quests, factions, encounterTables, sessionNotes, adventures, playerCharacters,
    regions, settlements, shops, shopCommissions, zoneMapTemplates, dungeons, battleMaps,
    doomClocks, triggerRules, campaignEvents, campaignEventLogs, worldTickLogs, rollLogEntries, chatMessages,
    downtimeActivities, codexNotes, ledgerEntries, factionRelationships,
  ] = await Promise.all([
    prisma.character.findMany({ where: scopeWhere }),
    prisma.item.findMany({ where: scopeWhere }),
    prisma.location.findMany({ where: scopeWhere }),
    prisma.questHook.findMany({ where: scopeWhere }),
    prisma.faction.findMany({ where: scopeWhere }),
    prisma.encounterTable.findMany({ where: scopeWhere }),
    prisma.sessionNote.findMany({ where: scopeWhere }),
    prisma.adventure.findMany({ where: scopeWhere }),
    prisma.playerCharacter.findMany({ where: scopeWhere }),
    prisma.region.findMany({ where: scopeWhere }),
    prisma.settlement.findMany({ where: scopeWhere }),
    prisma.shop.findMany({ where: scopeWhere }),
    prisma.shopCommission.findMany({ where: scopeWhere }),
    prisma.zoneMapTemplate.findMany({ where: scopeWhere }),
    prisma.dungeon.findMany({ where: scopeWhere }),
    prisma.battleMap.findMany({ where: scopeWhere }),
    prisma.doomClock.findMany({ where: scopeWhere }),
    prisma.triggerRule.findMany({ where: scopeWhere }),
    prisma.campaignEvent.findMany({ where: scopeWhere }),
    prisma.campaignEventLog.findMany({ where: scopeWhere }),
    prisma.worldTickLog.findMany({ where: scopeWhere }),
    prisma.rollLogEntry.findMany({ where: scopeWhere }),
    prisma.chatMessage.findMany({ where: scopeWhere }),
    prisma.downtimeActivity.findMany({ where: scopeWhere }),
    prisma.codexNote.findMany({ where: scopeWhere }),
    prisma.ledgerEntry.findMany({ where: scopeWhere }),
    prisma.factionRelationship.findMany({ where: scopeWhere }),
  ]);

  // Base and Encounter are shared party resources with no userId column of
  // their own (see their schema comments) — scoped by worldId membership
  // instead of the standard scopeWhere. BaseUpgrade/FactionLogEntry/
  // DispositionLogEntry have no worldId column either; scoped via the
  // parent rows already fetched above.
  const [bases, encounters] = await Promise.all([
    prisma.base.findMany({ where: { worldId: { in: worldIds } } }),
    prisma.encounter.findMany({ where: { worldId: { in: worldIds } } }),
  ]);
  const baseIds = bases.map((b) => b.id);
  const factionIds = factions.map((f) => f.id);
  const characterIds = characters.map((c) => c.id);
  const [baseUpgrades, factionLogEntries, dispositionLogEntries] = await Promise.all([
    prisma.baseUpgrade.findMany({ where: { baseId: { in: baseIds } } }),
    prisma.factionLogEntry.findMany({ where: { factionId: { in: factionIds } } }),
    prisma.dispositionLogEntry.findMany({ where: { characterId: { in: characterIds } } }),
  ]);

  const entityIds = new Set<string>([
    ...characters.map((c) => c.id), ...items.map((i) => i.id), ...locations.map((l) => l.id),
    ...quests.map((q) => q.id), ...factions.map((f) => f.id), ...encounterTables.map((e) => e.id),
    ...sessionNotes.map((n) => n.id), ...adventures.map((a) => a.id), ...playerCharacters.map((p) => p.id),
    ...regions.map((r) => r.id), ...settlements.map((s) => s.id), ...shops.map((s) => s.id),
    ...zoneMapTemplates.map((z) => z.id), ...dungeons.map((d) => d.id), ...battleMaps.map((b) => b.id),
  ]);

  const allLinks = await prisma.link.findMany({ where: hasSharedAccess ? {} : { userId } });
  const links = allLinks.filter((l) => entityIds.has(l.fromId) && entityIds.has(l.toId));

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    worlds: worlds.map((w) => ({
      id: w.id, name: w.name, description: w.description,
      houseRules: w.houseRules, currentDay: w.currentDay, nextSessionAt: w.nextSessionAt?.toISOString() ?? null,
    })),
    characters, items, locations, quests, factions, encounterTables, sessionNotes, adventures, playerCharacters,
    regions, settlements, shops, shopCommissions, zoneMapTemplates, dungeons, battleMaps,
    bases, baseUpgrades, doomClocks, triggerRules, campaignEvents, campaignEventLogs, worldTickLogs,
    rollLogEntries, chatMessages, downtimeActivities, codexNotes, ledgerEntries, encounters,
    factionRelationships, factionLogEntries, dispositionLogEntries,
    links: links.map(({ fromType, fromId, toType, toId, label }) => ({ fromType, fromId, toType, toId, label })),
  };
}

export interface ImportResult {
  worldsImported: number;
  entitiesImported: number;
  linksImported: number;
}

// Rewrites the battleMapId a dungeon room may carry (the dungeon-room /
// battle-map bridge) through the freshly-created BattleMap ids — the id
// lives inside the stringified rooms JSON, not a real relation column, so
// it needs its own parse/remap/reserialize pass rather than a plain field
// remap like everything else here.
function remapDungeonRooms(roomsJson: string, battleMapIdMap: Map<string, string>): string {
  let rooms: DungeonRoom[];
  try {
    rooms = JSON.parse(roomsJson);
  } catch {
    return roomsJson;
  }
  return JSON.stringify(rooms.map((r) => ({
    ...r,
    battleMapId: r.battleMapId ? battleMapIdMap.get(r.battleMapId) : undefined,
  })));
}

// Same idea for a combatant's playerCharacterId (the roster link a combatant
// snapshot carries when added "from Roster") inside Encounter.combatants.
function remapCombatants(combatantsJson: string, playerCharacterIdMap: Map<string, string>): string {
  let combatants: LiveCombatant[];
  try {
    combatants = JSON.parse(combatantsJson);
  } catch {
    return combatantsJson;
  }
  return JSON.stringify(combatants.map((c) => ({
    ...c,
    playerCharacterId: c.playerCharacterId ? playerCharacterIdMap.get(c.playerCharacterId) : undefined,
  })));
}

export async function applyImport(userId: string, bundle: ExportBundle): Promise<ImportResult> {
  return prisma.$transaction(async (tx) => {
    const worldIdMap = new Map<string, string>();
    const entityIdMap = new Map<string, string>();
    const factionIdMap = new Map<string, string>();
    const settlementIdMap = new Map<string, string>();
    const shopIdMap = new Map<string, string>();
    const baseIdMap = new Map<string, string>();
    const dungeonIdMap = new Map<string, string>();
    const battleMapIdMap = new Map<string, string>();
    const playerCharacterIdMap = new Map<string, string>();
    const characterIdMap = new Map<string, string>();
    const itemIdMap = new Map<string, string>();

    for (const w of bundle.worlds ?? []) {
      const created = await tx.world.create({
        data: {
          name: w.name, description: w.description, userId,
          houseRules: w.houseRules, currentDay: w.currentDay,
          nextSessionAt: w.nextSessionAt ? new Date(w.nextSessionAt) : null,
        },
      });
      worldIdMap.set(w.id, created.id);
    }

    const remapWorldId = (oldWorldId: string | null) => (oldWorldId ? worldIdMap.get(oldWorldId) ?? null : null);

    // Factions and regions have no dependencies on anything else exported
    // here, so they go first — settlements/characters/campaign events all
    // reference factions, and settlements reference regions.
    const regionIdMap = new Map<string, string>();
    for (const r of bundle.regions ?? []) {
      const created = await tx.region.create({
        data: {
          name: r.name, terrainCategory: r.terrainCategory, dangerLevel: r.dangerLevel, description: r.description,
          x: r.x, y: r.y, connections: r.connections, tags: r.tags, notes: r.notes,
          worldId: remapWorldId(r.worldId), hiddenFromParty: r.hiddenFromParty, userId,
        },
      });
      regionIdMap.set(r.id, created.id);
      entityIdMap.set(r.id, created.id);
    }

    for (const f of bundle.factions ?? []) {
      const created = await tx.faction.create({
        data: {
          name: f.name, factionType: f.factionType, agenda: f.agenda, methods: f.methods,
          publicFace: f.publicFace, hook: f.hook, tags: f.tags, notes: f.notes,
          worldId: remapWorldId(f.worldId), hiddenFromParty: f.hiddenFromParty, reputation: f.reputation, userId,
        },
      });
      factionIdMap.set(f.id, created.id);
      entityIdMap.set(f.id, created.id);
    }

    for (const s of bundle.settlements ?? []) {
      const created = await tx.settlement.create({
        data: {
          name: s.name, settlementType: s.settlementType, population: s.population, government: s.government,
          prosperity: s.prosperity, dangerLevel: s.dangerLevel, description: s.description,
          controllingFactionId: s.controllingFactionId ? factionIdMap.get(s.controllingFactionId) ?? null : null,
          regionId: s.regionId ? regionIdMap.get(s.regionId) ?? null : null,
          tags: s.tags, notes: s.notes, worldId: remapWorldId(s.worldId), hiddenFromParty: s.hiddenFromParty, userId,
        },
      });
      settlementIdMap.set(s.id, created.id);
      entityIdMap.set(s.id, created.id);
    }

    for (const c of bundle.characters ?? []) {
      const created = await tx.character.create({
        data: {
          kind: c.kind, name: c.name, race: c.race, background: c.background, alignment: c.alignment,
          templateId: c.templateId, templateName: c.templateName, statBlock: c.statBlock, backstory: c.backstory,
          tags: c.tags, notes: c.notes, equippedItems: c.equippedItems, attunedItems: c.attunedItems,
          disposition: c.disposition, perPcDisposition: c.perPcDisposition, status: c.status,
          factionId: c.factionId ? factionIdMap.get(c.factionId) ?? null : null,
          settlementId: c.settlementId ? settlementIdMap.get(c.settlementId) ?? null : null,
          worldId: remapWorldId(c.worldId), hiddenFromParty: c.hiddenFromParty, userId,
        },
      });
      characterIdMap.set(c.id, created.id);
      entityIdMap.set(c.id, created.id);
    }

    for (const i of bundle.items ?? []) {
      const created = await tx.item.create({
        data: {
          name: i.name, itemType: i.itemType, category: i.category, rarity: i.rarity, description: i.description,
          property: i.property, history: i.history, tags: i.tags, notes: i.notes, worldId: remapWorldId(i.worldId), hiddenFromParty: i.hiddenFromParty, userId,
          rarityTier: i.rarityTier, bonusType: i.bonusType, bonusValue: i.bonusValue, requiresAttunement: i.requiresAttunement,
          charges: i.charges, rechargeRule: i.rechargeRule, value: i.value,
        },
      });
      itemIdMap.set(i.id, created.id);
      entityIdMap.set(i.id, created.id);
    }

    for (const l of bundle.locations ?? []) {
      const created = await tx.location.create({
        data: {
          name: l.name, locationType: l.locationType, category: l.category, description: l.description,
          notableFeature: l.notableFeature, keeper: l.keeper, rumor: l.rumor,
          settlementId: l.settlementId ? settlementIdMap.get(l.settlementId) ?? null : null,
          tags: l.tags, notes: l.notes, worldId: remapWorldId(l.worldId), hiddenFromParty: l.hiddenFromParty, userId,
        },
      });
      entityIdMap.set(l.id, created.id);
    }

    // Quests can reference an earlier quest as a prerequisite — every quest
    // is created first (with no prerequisite), then a second pass patches
    // in the remapped prerequisiteQuestId now that every quest has a new id.
    const questIdMap = new Map<string, string>();
    for (const q of bundle.quests ?? []) {
      const created = await tx.questHook.create({
        data: {
          title: q.title, questType: q.questType, tier: q.tier, hook: q.hook, objective: q.objective,
          complication: q.complication, reward: q.reward, status: q.status, tags: q.tags, notes: q.notes,
          worldId: remapWorldId(q.worldId), hiddenFromParty: q.hiddenFromParty, userId,
        },
      });
      questIdMap.set(q.id, created.id);
      entityIdMap.set(q.id, created.id);
    }
    for (const q of bundle.quests ?? []) {
      if (!q.prerequisiteQuestId) continue;
      const newPrereqId = questIdMap.get(q.prerequisiteQuestId);
      if (!newPrereqId) continue;
      await tx.questHook.update({ where: { id: questIdMap.get(q.id)! }, data: { prerequisiteQuestId: newPrereqId } });
    }

    for (const e of bundle.encounterTables ?? []) {
      const created = await tx.encounterTable.create({
        data: {
          name: e.name, terrain: e.terrain, entries: e.entries, tags: e.tags, notes: e.notes,
          worldId: remapWorldId(e.worldId), hiddenFromParty: e.hiddenFromParty, userId,
        },
      });
      entityIdMap.set(e.id, created.id);
    }

    for (const n of bundle.sessionNotes ?? []) {
      const created = await tx.sessionNote.create({
        data: {
          title: n.title, sessionLabel: n.sessionLabel, sessionDate: n.sessionDate, summary: n.summary, looseThreads: n.looseThreads,
          nextSteps: n.nextSteps, tags: n.tags, notes: n.notes, worldId: remapWorldId(n.worldId), hiddenFromParty: n.hiddenFromParty, userId,
        },
      });
      entityIdMap.set(n.id, created.id);
    }

    for (const a of bundle.adventures ?? []) {
      const created = await tx.adventure.create({
        data: {
          title: a.title, tier: a.tier, premise: a.premise, hook: a.hook, objective: a.objective,
          complication: a.complication, reward: a.reward, tags: a.tags, notes: a.notes, worldId: remapWorldId(a.worldId), hiddenFromParty: a.hiddenFromParty, userId,
        },
      });
      entityIdMap.set(a.id, created.id);
    }

    for (const p of bundle.playerCharacters ?? []) {
      const created = await tx.playerCharacter.create({
        data: {
          name: p.name, className: p.className, level: p.level, race: p.race, armorClass: p.armorClass, maxHp: p.maxHp,
          currentHp: p.currentHp, abilityScores: p.abilityScores, playerName: p.playerName, tags: p.tags, notes: p.notes,
          equippedItems: p.equippedItems, attunedItems: p.attunedItems, deathSaves: p.deathSaves,
          spellSlots: p.spellSlots, preparedSpells: p.preparedSpells, skillProficiencies: p.skillProficiencies,
          classResources: p.classResources, conditions: p.conditions, xp: p.xp, proficiencyBonus: p.proficiencyBonus,
          worldId: remapWorldId(p.worldId), hiddenFromParty: p.hiddenFromParty, userId,
        },
      });
      playerCharacterIdMap.set(p.id, created.id);
      entityIdMap.set(p.id, created.id);
    }

    for (const s of bundle.shops ?? []) {
      const created = await tx.shop.create({
        data: {
          name: s.name, description: s.description, stock: s.stock, tags: s.tags, notes: s.notes,
          settlementId: s.settlementId ? settlementIdMap.get(s.settlementId) ?? null : null,
          worldId: remapWorldId(s.worldId), hiddenFromParty: s.hiddenFromParty, userId,
        },
      });
      shopIdMap.set(s.id, created.id);
      entityIdMap.set(s.id, created.id);
    }

    for (const c of bundle.shopCommissions ?? []) {
      const newWorldId = remapWorldId(c.worldId);
      const newShopId = shopIdMap.get(c.shopId);
      if (!newWorldId || !newShopId) continue;
      await tx.shopCommission.create({
        data: {
          worldId: newWorldId, shopId: newShopId, itemId: itemIdMap.get(c.itemId) ?? c.itemId,
          itemName: c.itemName, price: c.price, daysRequired: c.daysRequired, characterName: c.characterName,
          userId, deliveredAt: c.deliveredAt,
        },
      });
    }

    for (const z of bundle.zoneMapTemplates ?? []) {
      const created = await tx.zoneMapTemplate.create({
        data: { name: z.name, zones: z.zones, tags: z.tags, notes: z.notes, worldId: remapWorldId(z.worldId), hiddenFromParty: z.hiddenFromParty, userId },
      });
      entityIdMap.set(z.id, created.id);
    }

    for (const b of bundle.battleMaps ?? []) {
      const created = await tx.battleMap.create({
        data: {
          name: b.name, width: b.width, height: b.height, tiles: b.tiles, tags: b.tags, notes: b.notes,
          worldId: remapWorldId(b.worldId), hiddenFromParty: b.hiddenFromParty, userId,
        },
      });
      battleMapIdMap.set(b.id, created.id);
      entityIdMap.set(b.id, created.id);
    }

    for (const d of bundle.dungeons ?? []) {
      const created = await tx.dungeon.create({
        data: {
          name: d.name, rooms: remapDungeonRooms(d.rooms, battleMapIdMap), tags: d.tags, notes: d.notes,
          worldId: remapWorldId(d.worldId), hiddenFromParty: d.hiddenFromParty, userId,
        },
      });
      dungeonIdMap.set(d.id, created.id);
      entityIdMap.set(d.id, created.id);
    }

    for (const b of bundle.bases ?? []) {
      const newWorldId = remapWorldId(b.worldId);
      if (!newWorldId) continue;
      const created = await tx.base.create({ data: { worldId: newWorldId, name: b.name } });
      baseIdMap.set(b.id, created.id);
    }
    for (const u of bundle.baseUpgrades ?? []) {
      const newBaseId = baseIdMap.get(u.baseId);
      if (!newBaseId) continue;
      await tx.baseUpgrade.create({
        data: { baseId: newBaseId, upgradeId: u.upgradeId, acquiredAt: u.acquiredAt, shopId: u.shopId ? shopIdMap.get(u.shopId) ?? u.shopId : null },
      });
    }

    for (const d of bundle.doomClocks ?? []) {
      const newWorldId = remapWorldId(d.worldId);
      if (!newWorldId) continue;
      await tx.doomClock.create({
        data: { worldId: newWorldId, label: d.label, segments: d.segments, filled: d.filled, visibleToParty: d.visibleToParty, userId },
      });
    }

    for (const t of bundle.triggerRules ?? []) {
      const newWorldId = remapWorldId(t.worldId);
      if (!newWorldId) continue;
      await tx.triggerRule.create({
        data: { worldId: newWorldId, name: t.name, condition: t.condition, message: t.message, announceInChat: t.announceInChat, enabled: t.enabled, userId },
      });
    }

    for (const e of bundle.campaignEvents ?? []) {
      const newWorldId = remapWorldId(e.worldId);
      if (!newWorldId) continue;
      await tx.campaignEvent.create({
        data: { worldId: newWorldId, title: e.title, description: e.description, factionId: e.factionId ? factionIdMap.get(e.factionId) ?? e.factionId : null, userId },
      });
    }

    // entityId is a polymorphic reference (entityType names the table) —
    // left unremapped, same accepted-orphan posture as PublishedEntry and
    // GuildJobClaim already take for their own loose cross-entity refs.
    for (const l of bundle.campaignEventLogs ?? []) {
      await tx.campaignEventLog.create({
        data: {
          worldId: remapWorldId(l.worldId), entityType: l.entityType, entityId: l.entityId,
          eventType: l.eventType, payload: l.payload, authorName: l.authorName, userId,
        },
      });
    }

    for (const w of bundle.worldTickLogs ?? []) {
      const newWorldId = remapWorldId(w.worldId);
      if (!newWorldId) continue;
      await tx.worldTickLog.create({ data: { worldId: newWorldId, fromDay: w.fromDay, toDay: w.toDay, itemCount: w.itemCount, userId } });
    }

    for (const r of bundle.rollLogEntries ?? []) {
      const newWorldId = remapWorldId(r.worldId);
      if (!newWorldId) continue;
      await tx.rollLogEntry.create({
        data: {
          worldId: newWorldId, userId, rollerName: r.rollerName, notation: r.notation, results: r.results,
          modifier: r.modifier, total: r.total, mode: r.mode, label: r.label, hiddenFromParty: r.hiddenFromParty,
        },
      });
    }

    for (const m of bundle.chatMessages ?? []) {
      const newWorldId = remapWorldId(m.worldId);
      if (!newWorldId) continue;
      await tx.chatMessage.create({
        data: { worldId: newWorldId, userId, senderName: m.senderName, text: m.text, rollData: m.rollData, reactions: m.reactions },
      });
    }

    for (const d of bundle.downtimeActivities ?? []) {
      const newWorldId = remapWorldId(d.worldId);
      if (!newWorldId) continue;
      await tx.downtimeActivity.create({
        data: {
          worldId: newWorldId, userId, playerCharacterId: d.playerCharacterId ? playerCharacterIdMap.get(d.playerCharacterId) ?? d.playerCharacterId : null,
          characterName: d.characterName, activityType: d.activityType, description: d.description,
          daysSpent: d.daysSpent, outcome: d.outcome, craftedItemId: d.craftedItemId ? itemIdMap.get(d.craftedItemId) ?? d.craftedItemId : null,
        },
      });
    }

    // entityId is a polymorphic reference, same unremapped posture as
    // CampaignEventLog above.
    for (const n of bundle.codexNotes ?? []) {
      const newWorldId = remapWorldId(n.worldId);
      if (!newWorldId) continue;
      await tx.codexNote.create({
        data: { worldId: newWorldId, userId, entityType: n.entityType, entityId: n.entityId, authorName: n.authorName, text: n.text },
      });
    }

    for (const l of bundle.ledgerEntries ?? []) {
      const newWorldId = remapWorldId(l.worldId);
      if (!newWorldId) continue;
      await tx.ledgerEntry.create({
        data: { worldId: newWorldId, userId, kind: l.kind, label: l.label, amount: l.amount, authorName: l.authorName, itemId: l.itemId ? itemIdMap.get(l.itemId) ?? l.itemId : null },
      });
    }

    for (const e of bundle.encounters ?? []) {
      const newWorldId = remapWorldId(e.worldId);
      if (!newWorldId) continue;
      await tx.encounter.create({
        data: {
          worldId: newWorldId, combatants: remapCombatants(e.combatants, playerCharacterIdMap),
          round: e.round, turnIndex: e.turnIndex, zones: e.zones, zoneEffects: e.zoneEffects,
          activeDungeonId: e.activeDungeonId ? dungeonIdMap.get(e.activeDungeonId) ?? null : null,
          activeDungeonRoomId: e.activeDungeonRoomId,
          activeBattleMapId: e.activeBattleMapId ? battleMapIdMap.get(e.activeBattleMapId) ?? null : null,
          exploredCells: e.exploredCells, openDoorCells: e.openDoorCells,
        },
      });
    }

    for (const r of bundle.factionRelationships ?? []) {
      const newWorldId = remapWorldId(r.worldId);
      const newFactionAId = factionIdMap.get(r.factionAId);
      const newFactionBId = factionIdMap.get(r.factionBId);
      if (!newWorldId || !newFactionAId || !newFactionBId) continue;
      await tx.factionRelationship.create({
        data: { worldId: newWorldId, factionAId: newFactionAId, factionBId: newFactionBId, stance: r.stance, notes: r.notes, userId },
      });
    }

    for (const l of bundle.factionLogEntries ?? []) {
      const newFactionId = factionIdMap.get(l.factionId);
      if (!newFactionId) continue;
      await tx.factionLogEntry.create({ data: { factionId: newFactionId, authorName: l.authorName, delta: l.delta, reason: l.reason, userId } });
    }

    for (const l of bundle.dispositionLogEntries ?? []) {
      const newCharacterId = characterIdMap.get(l.characterId);
      if (!newCharacterId) continue;
      await tx.dispositionLogEntry.create({
        data: {
          characterId: newCharacterId, authorName: l.authorName, delta: l.delta, reason: l.reason,
          playerCharacterId: l.playerCharacterId ? playerCharacterIdMap.get(l.playerCharacterId) ?? l.playerCharacterId : null,
          userId,
        },
      });
    }

    let linksImported = 0;
    for (const l of bundle.links ?? []) {
      const newFromId = entityIdMap.get(l.fromId);
      const newToId = entityIdMap.get(l.toId);
      if (!newFromId || !newToId) continue;
      await tx.link.create({ data: { fromType: l.fromType, fromId: newFromId, toType: l.toType, toId: newToId, label: l.label, userId } });
      linksImported++;
    }

    return { worldsImported: worldIdMap.size, entitiesImported: entityIdMap.size, linksImported };
  });
}
