import type {
  Character as CharacterRow, Item as ItemRow, Location as LocationRow, QuestHook as QuestHookRow,
  Faction as FactionRow, EncounterTable as EncounterTableRow, SessionNote as SessionNoteRow,
  Adventure as AdventureRow, PlayerCharacter as PlayerCharacterRow, RollLogEntry as RollLogEntryRow,
  Encounter as EncounterRow, CodexNote as CodexNoteRow, LedgerEntry as LedgerEntryRow,
  ZoneMapTemplate as ZoneMapTemplateRow, Dungeon as DungeonRow, DowntimeActivity as DowntimeActivityRow, Shop as ShopRow,
  Region as RegionRow, Settlement as SettlementRow, ChatMessage as ChatMessageRow, BattleMap as BattleMapRow,
  DispositionLogEntry as DispositionLogEntryRow, ShopCommission as ShopCommissionRow,
  FactionLogEntry as FactionLogEntryRow, FactionRelationship as FactionRelationshipRow,
  CampaignEvent as CampaignEventRow, WorldTickLog as WorldTickLogRow, DoomClock as DoomClockRow,
  CampaignEventLog as CampaignEventLogRow, TriggerRule as TriggerRuleRow,
} from "@prisma/client";
import type {
  Character, Item, Location, QuestHook, Faction, EncounterTable, SessionNote, Adventure, PlayerCharacter, RollLogEntry,
  Encounter, LiveCombatant, HpStatus, CodexNote, EntityType, LedgerEntry, LedgerEntryKind, EncounterZone, EncounterZoneEffect,
  ZoneMapTemplate, Dungeon, DowntimeActivity, DowntimeActivityType, Shop, ShopStockEntry, Region, Settlement, ChatMessage, BattleMap,
  DispositionLogEntry, ShopCommission, FactionLogEntry, FactionRelationship, FactionRelationshipStance, CampaignEvent,
  PlacedTile, WorldTickLog, DoomClock, CampaignEventLogEntry, TriggerRule, TriggerCondition,
  StatBlock, Backstory, AbilityScores,
} from "@spark/shared";

// Every JSON column here is written by this server via JSON.stringify, so
// under normal operation it always parses. It can still be malformed if a
// row arrived another way — a hand-edited backup file coming back through
// the import route, a dump restored from an older schema, a direct edit of
// the database — and a throw inside a serializer fails the whole request,
// so one damaged row would take down an entire list endpoint (and with it
// the user's roster or inventory) rather than just itself. Falling back
// keeps the rest of the response intact and renders the damaged row as
// empty, which the user can see and fix, instead of an opaque 500 with no
// way out through the UI.
function parseColumn<T>(raw: string | null | undefined, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Stand-ins for the structured columns above, used only when a row's JSON
// won't parse. They're deliberately blank rather than plausible-looking:
// a character showing 0s and empty strings reads as damaged data the user
// can go fix, where invented values would look like real content.
const EMPTY_ABILITY_SCORES: AbilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
const EMPTY_STAT_BLOCK: StatBlock = {
  size: "", creatureType: "", alignment: "", armorClass: 0, hitPointsAverage: 0,
  hitDiceFormula: "", speed: "", abilityScores: EMPTY_ABILITY_SCORES, senses: "",
  languages: "", challengeRating: "", proficiencyBonus: 0, xp: 0, traits: [], actions: [],
};
const EMPTY_BACKSTORY: Backstory = {
  occupationOrRole: "", personalityTrait: "", ideal: "", bond: "", flaw: "",
  appearance: "", mannerism: "", motivation: "", secret: "",
};

export function toCharacterDTO(row: CharacterRow): Character {
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind as Character["kind"],
    name: row.name,
    race: row.race ?? undefined,
    background: row.background ?? undefined,
    alignment: row.alignment,
    templateId: row.templateId,
    templateName: row.templateName,
    statBlock: parseColumn(row.statBlock, EMPTY_STAT_BLOCK),
    backstory: parseColumn(row.backstory, EMPTY_BACKSTORY),
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    tags: parseColumn(row.tags, []),
    notes: row.notes ?? undefined,
    equippedItems: parseColumn(row.equippedItems, []),
    attunedItems: parseColumn(row.attunedItems, []),
    disposition: row.disposition,
    perPcDisposition: parseColumn(row.perPcDisposition, {}),
    status: row.status as Character["status"],
    factionId: row.factionId,
    settlementId: row.settlementId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toDispositionLogEntryDTO(row: DispositionLogEntryRow): DispositionLogEntry {
  return {
    id: row.id,
    characterId: row.characterId,
    userId: row.userId,
    authorName: row.authorName,
    delta: row.delta,
    reason: row.reason ?? undefined,
    playerCharacterId: row.playerCharacterId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toItemDTO(row: ItemRow): Item {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    itemType: row.itemType,
    category: row.category,
    rarity: row.rarity,
    rarityTier: row.rarityTier,
    description: row.description,
    property: row.property,
    history: row.history,
    bonusType: row.bonusType as Item["bonusType"],
    bonusValue: row.bonusValue,
    requiresAttunement: row.requiresAttunement,
    charges: row.charges,
    rechargeRule: row.rechargeRule,
    value: row.value,
    weight: row.weight ?? undefined,
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    tags: parseColumn(row.tags, []),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toLocationDTO(row: LocationRow): Location {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    locationType: row.locationType,
    category: row.category,
    description: row.description,
    notableFeature: row.notableFeature,
    keeper: row.keeper,
    rumor: row.rumor,
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    settlementId: row.settlementId,
    tags: parseColumn(row.tags, []),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toRegionDTO(row: RegionRow): Region {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    terrainCategory: row.terrainCategory,
    dangerLevel: row.dangerLevel ?? undefined,
    description: row.description,
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    x: row.x,
    y: row.y,
    connections: parseColumn(row.connections, []),
    tags: parseColumn(row.tags, []),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toSettlementDTO(row: SettlementRow): Settlement {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    settlementType: row.settlementType,
    population: row.population ?? undefined,
    government: row.government ?? undefined,
    prosperity: row.prosperity ?? undefined,
    dangerLevel: row.dangerLevel ?? undefined,
    controllingFactionId: row.controllingFactionId,
    description: row.description,
    regionId: row.regionId,
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    tags: parseColumn(row.tags, []),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toFactionDTO(row: FactionRow): Faction {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    factionType: row.factionType,
    agenda: row.agenda,
    methods: row.methods,
    publicFace: row.publicFace,
    hook: row.hook,
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    reputation: row.reputation,
    tags: parseColumn(row.tags, []),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toFactionLogEntryDTO(row: FactionLogEntryRow): FactionLogEntry {
  return {
    id: row.id,
    factionId: row.factionId,
    userId: row.userId,
    authorName: row.authorName,
    delta: row.delta,
    reason: row.reason ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toFactionRelationshipDTO(row: FactionRelationshipRow): FactionRelationship {
  return {
    id: row.id,
    worldId: row.worldId,
    factionAId: row.factionAId,
    factionBId: row.factionBId,
    stance: row.stance as FactionRelationshipStance,
    notes: row.notes ?? undefined,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toEncounterTableDTO(row: EncounterTableRow): EncounterTable {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    terrain: row.terrain,
    entries: parseColumn(row.entries, []),
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    tags: parseColumn(row.tags, []),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Mirrors toEncounterDTO's zone redaction (below): a non-owner never sees a
// zone the DM hasn't marked revealed, same spoiler concern as a live
// encounter's unrevealed zones, just applied to the template these rooms
// get loaded from instead of the live combat state itself.
export function toZoneMapTemplateDTO(row: ZoneMapTemplateRow, viewerId?: string): ZoneMapTemplate {
  const isOwner = viewerId === row.userId;
  const allZones: EncounterZone[] = parseColumn(row.zones, []);
  const visibleZones = isOwner ? allZones : allZones.filter((z) => z.revealed);
  const visibleZoneIds = new Set(visibleZones.map((z) => z.id));
  const zones: EncounterZone[] = visibleZones.map((z) => ({
    ...z,
    connections: isOwner ? z.connections : z.connections.filter((id) => visibleZoneIds.has(id)),
  }));
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    zones,
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    tags: parseColumn(row.tags, []),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// A viewer who isn't the map's owner never sees gmOnly-layer placements —
// they're the DM's secret door / trap warning markers, stripped here
// rather than trusted to the client to hide, same trust boundary as every
// other "owner sees everything, everyone else gets the redacted view"
// DTO in this file. Omit viewerId for a context that's always the owner
// (a POST/PATCH response returned straight to the actor who just wrote it).
export function toBattleMapDTO(row: BattleMapRow, viewerId?: string): BattleMap {
  const tiles: PlacedTile[] = parseColumn(row.tiles, []);
  const visibleTiles = viewerId && viewerId !== row.userId ? tiles.filter((t) => t.layer !== "gmOnly") : tiles;
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    width: row.width,
    height: row.height,
    tiles: visibleTiles,
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    tags: parseColumn(row.tags, []),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toDungeonDTO(row: DungeonRow): Dungeon {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    rooms: parseColumn(row.rooms, []),
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    tags: parseColumn(row.tags, []),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toShopDTO(row: ShopRow): Shop {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? undefined,
    stock: parseColumn(row.stock, []) as ShopStockEntry[],
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    tags: parseColumn(row.tags, []),
    notes: row.notes ?? undefined,
    settlementId: row.settlementId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toShopCommissionDTO(row: ShopCommissionRow): ShopCommission {
  return {
    id: row.id,
    worldId: row.worldId,
    shopId: row.shopId,
    itemId: row.itemId,
    itemName: row.itemName,
    price: row.price,
    daysRequired: row.daysRequired,
    characterName: row.characterName,
    userId: row.userId,
    deliveredAt: row.deliveredAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toSessionNoteDTO(row: SessionNoteRow, viewerId: string): SessionNote {
  const isOwner = row.userId === viewerId;
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    sessionLabel: row.sessionLabel ?? undefined,
    sessionDate: row.sessionDate ? row.sessionDate.toISOString().slice(0, 10) : undefined,
    summary: row.summary,
    looseThreads: isOwner ? row.looseThreads ?? undefined : undefined,
    nextSteps: isOwner ? row.nextSteps ?? undefined : undefined,
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    tags: parseColumn(row.tags, []),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCampaignEventDTO(row: CampaignEventRow): CampaignEvent {
  return {
    id: row.id,
    worldId: row.worldId,
    title: row.title,
    description: row.description,
    factionId: row.factionId ?? undefined,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toCampaignEventLogEntryDTO(row: CampaignEventLogRow): CampaignEventLogEntry {
  return {
    id: row.id,
    worldId: row.worldId,
    entityType: row.entityType as CampaignEventLogEntry["entityType"],
    entityId: row.entityId,
    eventType: row.eventType,
    payload: parseColumn(row.payload, {}),
    authorName: row.authorName,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toWorldTickLogDTO(row: WorldTickLogRow): WorldTickLog {
  return {
    id: row.id,
    worldId: row.worldId,
    fromDay: row.fromDay,
    toDay: row.toDay,
    itemCount: row.itemCount,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toDoomClockDTO(row: DoomClockRow): DoomClock {
  return {
    id: row.id,
    worldId: row.worldId,
    userId: row.userId,
    label: row.label,
    segments: row.segments,
    filled: row.filled,
    visibleToParty: row.visibleToParty,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTriggerRuleDTO(row: TriggerRuleRow): TriggerRule {
  return {
    id: row.id,
    worldId: row.worldId,
    userId: row.userId,
    name: row.name,
    condition: parseColumn(row.condition, {}) as TriggerCondition,
    message: row.message,
    announceInChat: row.announceInChat,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toQuestHookDTO(row: QuestHookRow): QuestHook {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    questType: row.questType,
    tier: row.tier,
    hook: row.hook,
    objective: row.objective,
    complication: row.complication,
    reward: row.reward,
    status: row.status as QuestHook["status"],
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    tags: parseColumn(row.tags, []),
    notes: row.notes ?? undefined,
    prerequisiteQuestId: row.prerequisiteQuestId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAdventureDTO(row: AdventureRow): Adventure {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    tier: row.tier,
    premise: row.premise,
    hook: row.hook,
    objective: row.objective,
    complication: row.complication,
    reward: row.reward,
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    tags: parseColumn(row.tags, []),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toRollLogEntryDTO(row: RollLogEntryRow): RollLogEntry {
  return {
    id: row.id,
    worldId: row.worldId,
    userId: row.userId,
    rollerName: row.rollerName,
    notation: row.notation,
    results: parseColumn(row.results, []),
    modifier: row.modifier,
    total: row.total,
    mode: row.mode === "adv" || row.mode === "dis" ? row.mode : undefined,
    label: row.label ?? undefined,
    hiddenFromParty: row.hiddenFromParty,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toChatMessageDTO(row: ChatMessageRow): ChatMessage {
  const reactions = parseColumn(row.reactions, {}) as Record<string, string[]>;
  return {
    id: row.id,
    worldId: row.worldId,
    userId: row.userId,
    senderName: row.senderName,
    text: row.text,
    roll: parseColumn(row.rollData, undefined),
    reactions: Object.keys(reactions).length > 0 ? reactions : undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toDowntimeActivityDTO(row: DowntimeActivityRow): DowntimeActivity {
  return {
    id: row.id,
    worldId: row.worldId,
    userId: row.userId,
    playerCharacterId: row.playerCharacterId ?? undefined,
    characterName: row.characterName,
    activityType: row.activityType as DowntimeActivityType,
    description: row.description,
    daysSpent: row.daysSpent,
    outcome: row.outcome ?? undefined,
    craftedItemId: row.craftedItemId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toCodexNoteDTO(row: CodexNoteRow): CodexNote {
  return {
    id: row.id,
    worldId: row.worldId,
    userId: row.userId,
    entityType: row.entityType as EntityType,
    entityId: row.entityId,
    authorName: row.authorName,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toLedgerEntryDTO(row: LedgerEntryRow): LedgerEntry {
  return {
    id: row.id,
    worldId: row.worldId,
    userId: row.userId,
    kind: row.kind as LedgerEntryKind,
    label: row.label,
    amount: row.amount,
    authorName: row.authorName,
    itemId: row.itemId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function computeHpStatus(current?: number, max?: number): HpStatus {
  if (current === undefined || max === undefined || max <= 0) return "healthy";
  if (current <= 0) return "down";
  const ratio = current / max;
  if (ratio <= 0.25) return "nearDeath";
  if (ratio <= 0.5) return "bloodied";
  if (ratio < 1) return "injured";
  return "healthy";
}

export function toEncounterDTO(row: EncounterRow, viewerId: string, worldOwnerId: string, visibleCells?: Set<string>): Encounter {
  const isOwner = viewerId === worldOwnerId;

  const allZones: EncounterZone[] = parseColumn(row.zones, []);
  const visibleZones = isOwner ? allZones : allZones.filter((z) => z.revealed);
  const visibleZoneIds = new Set(visibleZones.map((z) => z.id));
  const zones: EncounterZone[] = visibleZones.map((z) => ({
    ...z,
    connections: isOwner ? z.connections : z.connections.filter((id) => visibleZoneIds.has(id)),
  }));

  const allZoneEffects: EncounterZoneEffect[] = parseColumn(row.zoneEffects, []);
  const zoneEffects = allZoneEffects.filter(
    (e) => e.expiresAtRound >= row.round && (isOwner || visibleZoneIds.has(e.zoneId)),
  );

  const combatants: LiveCombatant[] = parseColumn(row.combatants, [])
    .map((c: LiveCombatant) => {
      const hpStatus = computeHpStatus(c.currentHp, c.maxHp);
      const showHp = isOwner || c.hpVisible;
      return {
        ...c,
        hpStatus,
        currentHp: showHp ? c.currentHp : undefined,
        maxHp: showHp ? c.maxHp : undefined,
        xp: isOwner ? c.xp : undefined,
        // Damage dice/to-hit bonuses are DM-side prep info, same spoiler
        // concern as xp above — a player shouldn't be able to read a
        // monster's exact attack bonus off the wire before it's rolled.
        attacks: isOwner ? c.attacks : undefined,
        // legendaryActionsMax/Remaining stay visible to everyone — knowing
        // a boss can still act between turns is real tactical information
        // at the table, not a spoiler. The action descriptions themselves
        // are withheld from non-owners for the same reason attacks are.
        legendaryActionsList: isOwner ? c.legendaryActionsList : undefined,
        lairActionsList: isOwner ? c.lairActionsList : undefined,
        conditions: (c.conditions ?? []).filter((cond) => cond.expiresAtRound === null || cond.expiresAtRound >= row.round),
      };
    })
    .filter((c: LiveCombatant) => {
      if (isOwner) return true;
      if (c.hidden) return false;
      if (c.zoneId && !visibleZoneIds.has(c.zoneId)) return false;
      // Fog-of-war: a non-PC token off the party's current grid vision is
      // withheld the same way a hidden combatant already is. Only applies
      // when a battle map is actually active (visibleCells passed in) —
      // the party's own PCs are never fog-gated, same as they aren't
      // subject to the `hidden` flag either.
      if (visibleCells && c.kind !== "playerCharacter" && c.gridX !== undefined && c.gridY !== undefined) {
        if (!visibleCells.has(`${c.gridX},${c.gridY}`)) return false;
      }
      return true;
    });

  return {
    worldId: row.worldId,
    combatants,
    round: row.round,
    turnIndex: row.turnIndex,
    zones,
    zoneEffects,
    activeDungeonId: row.activeDungeonId ?? undefined,
    activeDungeonRoomId: row.activeDungeonRoomId ?? undefined,
    activeBattleMapId: row.activeBattleMapId ?? undefined,
    exploredCells: parseColumn(row.exploredCells, []),
    // Not secret — same as exploredCells, every viewer sees which doors
    // are currently open.
    openDoorCells: parseColumn(row.openDoorCells, []),
    visibleCells: isOwner ? undefined : (visibleCells ? [...visibleCells] : undefined),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPlayerCharacterDTO(row: PlayerCharacterRow): PlayerCharacter {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    className: row.className,
    level: row.level,
    race: row.race,
    armorClass: row.armorClass,
    maxHp: row.maxHp,
    abilityScores: parseColumn(row.abilityScores, EMPTY_ABILITY_SCORES),
    playerName: row.playerName ?? undefined,
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    tags: parseColumn(row.tags, []),
    notes: row.notes ?? undefined,
    equippedItems: parseColumn(row.equippedItems, []),
    attunedItems: parseColumn(row.attunedItems, []),
    currentHp: row.currentHp,
    deathSaves: parseColumn(row.deathSaves, { successes: 0, failures: 0 }),
    spellSlots: parseColumn(row.spellSlots, []),
    preparedSpells: parseColumn(row.preparedSpells, []),
    skillProficiencies: parseColumn(row.skillProficiencies, []),
    classResources: parseColumn(row.classResources, []),
    conditions: parseColumn(row.conditions, []),
    xp: row.xp,
    proficiencyBonus: row.proficiencyBonus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
