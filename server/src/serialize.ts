import type {
  Character as CharacterRow, Item as ItemRow, Location as LocationRow, QuestHook as QuestHookRow,
  Faction as FactionRow, EncounterTable as EncounterTableRow, SessionNote as SessionNoteRow,
  Adventure as AdventureRow, PlayerCharacter as PlayerCharacterRow,
} from "@prisma/client";
import type { Character, Item, Location, QuestHook, Faction, EncounterTable, SessionNote, Adventure, PlayerCharacter } from "@spark/shared";

export function toCharacterDTO(row: CharacterRow): Character {
  return {
    id: row.id,
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

export function toSessionNoteDTO(row: SessionNoteRow): SessionNote {
  return {
    id: row.id,
    title: row.title,
    sessionLabel: row.sessionLabel ?? undefined,
    summary: row.summary,
    looseThreads: row.looseThreads ?? undefined,
    nextSteps: row.nextSteps ?? undefined,
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

export function toPlayerCharacterDTO(row: PlayerCharacterRow): PlayerCharacter {
  return {
    id: row.id,
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
