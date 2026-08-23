import type {
  Character as CharacterRow, Item as ItemRow, Location as LocationRow, QuestHook as QuestHookRow,
  Faction as FactionRow, EncounterTable as EncounterTableRow, SessionNote as SessionNoteRow,
  Adventure as AdventureRow, PlayerCharacter as PlayerCharacterRow, RollLogEntry as RollLogEntryRow,
  Encounter as EncounterRow, CodexNote as CodexNoteRow, LedgerEntry as LedgerEntryRow,
  ZoneMapTemplate as ZoneMapTemplateRow, Dungeon as DungeonRow, DowntimeActivity as DowntimeActivityRow, Shop as ShopRow,
  Region as RegionRow, Settlement as SettlementRow, ChatMessage as ChatMessageRow, BattleMap as BattleMapRow,
  DispositionLogEntry as DispositionLogEntryRow, ShopCommission as ShopCommissionRow,
  FactionLogEntry as FactionLogEntryRow, FactionRelationship as FactionRelationshipRow,
  CampaignEvent as CampaignEventRow,
} from "@prisma/client";
import type {
  Character, Item, Location, QuestHook, Faction, EncounterTable, SessionNote, Adventure, PlayerCharacter, RollLogEntry,
  Encounter, LiveCombatant, HpStatus, CodexNote, EntityType, LedgerEntry, LedgerEntryKind, EncounterZone, EncounterZoneEffect,
  ZoneMapTemplate, Dungeon, DowntimeActivity, DowntimeActivityType, Shop, ShopStockEntry, Region, Settlement, ChatMessage, BattleMap,
  DispositionLogEntry, ShopCommission, FactionLogEntry, FactionRelationship, FactionRelationshipStance, CampaignEvent,
  PlacedTile,
} from "@spark/shared";

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
    statBlock: JSON.parse(row.statBlock),
    backstory: JSON.parse(row.backstory),
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    tags: JSON.parse(row.tags),
    notes: row.notes ?? undefined,
    equippedItems: JSON.parse(row.equippedItems),
    attunedItems: JSON.parse(row.attunedItems),
    disposition: row.disposition,
    factionId: row.factionId,
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
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    tags: JSON.parse(row.tags),
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
    tags: JSON.parse(row.tags),
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
    connections: JSON.parse(row.connections),
    tags: JSON.parse(row.tags),
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
    tags: JSON.parse(row.tags),
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
    tags: JSON.parse(row.tags),
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
    entries: JSON.parse(row.entries),
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    tags: JSON.parse(row.tags),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toZoneMapTemplateDTO(row: ZoneMapTemplateRow): ZoneMapTemplate {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    zones: JSON.parse(row.zones),
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    tags: JSON.parse(row.tags),
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
  const tiles: PlacedTile[] = JSON.parse(row.tiles);
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
    tags: JSON.parse(row.tags),
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
    rooms: JSON.parse(row.rooms),
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    tags: JSON.parse(row.tags),
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
    stock: JSON.parse(row.stock) as ShopStockEntry[],
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    tags: JSON.parse(row.tags),
    notes: row.notes ?? undefined,
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
    tags: JSON.parse(row.tags),
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
    tags: JSON.parse(row.tags),
    notes: row.notes ?? undefined,
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
    tags: JSON.parse(row.tags),
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
    results: JSON.parse(row.results),
    modifier: row.modifier,
    total: row.total,
    mode: row.mode === "adv" || row.mode === "dis" ? row.mode : undefined,
    label: row.label ?? undefined,
    hiddenFromParty: row.hiddenFromParty,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toChatMessageDTO(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    worldId: row.worldId,
    userId: row.userId,
    senderName: row.senderName,
    text: row.text,
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

  const allZones: EncounterZone[] = JSON.parse(row.zones);
  const visibleZones = isOwner ? allZones : allZones.filter((z) => z.revealed);
  const visibleZoneIds = new Set(visibleZones.map((z) => z.id));
  const zones: EncounterZone[] = visibleZones.map((z) => ({
    ...z,
    connections: isOwner ? z.connections : z.connections.filter((id) => visibleZoneIds.has(id)),
  }));

  const allZoneEffects: EncounterZoneEffect[] = JSON.parse(row.zoneEffects);
  const zoneEffects = allZoneEffects.filter(
    (e) => e.expiresAtRound >= row.round && (isOwner || visibleZoneIds.has(e.zoneId)),
  );

  const combatants: LiveCombatant[] = JSON.parse(row.combatants)
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
    exploredCells: JSON.parse(row.exploredCells ?? "[]"),
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
    abilityScores: JSON.parse(row.abilityScores),
    playerName: row.playerName ?? undefined,
    worldId: row.worldId,
    hiddenFromParty: row.hiddenFromParty,
    tags: JSON.parse(row.tags),
    notes: row.notes ?? undefined,
    equippedItems: JSON.parse(row.equippedItems),
    attunedItems: JSON.parse(row.attunedItems),
    currentHp: row.currentHp,
    deathSaves: JSON.parse(row.deathSaves),
    spellSlots: JSON.parse(row.spellSlots),
    preparedSpells: JSON.parse(row.preparedSpells),
    classResources: JSON.parse(row.classResources),
    conditions: JSON.parse(row.conditions),
    xp: row.xp,
    proficiencyBonus: row.proficiencyBonus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
