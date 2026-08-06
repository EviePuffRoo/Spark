import type {
  Character as CharacterRow, Item as ItemRow, Location as LocationRow, QuestHook as QuestHookRow,
  Faction as FactionRow, EncounterTable as EncounterTableRow, SessionNote as SessionNoteRow,
  Adventure as AdventureRow, PlayerCharacter as PlayerCharacterRow, RollLogEntry as RollLogEntryRow,
  Encounter as EncounterRow, CodexNote as CodexNoteRow, LedgerEntry as LedgerEntryRow,
} from "@prisma/client";
import type {
  Character, Item, Location, QuestHook, Faction, EncounterTable, SessionNote, Adventure, PlayerCharacter, RollLogEntry,
  Encounter, LiveCombatant, HpStatus, CodexNote, EntityType, LedgerEntry, LedgerEntryKind, EncounterZone, EncounterZoneEffect,
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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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
    description: row.description,
    property: row.property,
    history: row.history,
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
    tags: JSON.parse(row.tags),
    notes: row.notes ?? undefined,
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

export function toEncounterDTO(row: EncounterRow, viewerId: string, worldOwnerId: string): Encounter {
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
      };
    })
    .filter((c: LiveCombatant) => {
      if (isOwner) return true;
      if (c.hidden) return false;
      if (c.zoneId && !visibleZoneIds.has(c.zoneId)) return false;
      return true;
    });

  return {
    worldId: row.worldId,
    combatants,
    round: row.round,
    turnIndex: row.turnIndex,
    zones,
    zoneEffects,
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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
