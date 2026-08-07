export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type AbilityScores = Record<AbilityKey, number>;

export interface StatBlockAction {
  name: string;
  description: string;
}

export interface StatBlock {
  size: string;
  creatureType: string;
  alignment: string;
  armorClass: number;
  armorClassNote?: string;
  hitPointsAverage: number;
  hitDiceFormula: string;
  speed: string;
  abilityScores: AbilityScores;
  savingThrows?: string;
  skills?: string;
  damageResistances?: string;
  damageImmunities?: string;
  conditionImmunities?: string;
  senses: string;
  languages: string;
  challengeRating: string;
  proficiencyBonus: number;
  xp: number;
  traits: StatBlockAction[];
  actions: StatBlockAction[];
  reactions?: StatBlockAction[];
}

export interface Backstory {
  occupationOrRole: string;
  personalityTrait: string;
  ideal: string;
  bond: string;
  flaw: string;
  appearance: string;
  mannerism: string;
  motivation: string;
  secret: string;
}

export type CharacterKind = "npc" | "monster";

export interface Character {
  id: string;
  userId: string;
  kind: CharacterKind;
  name: string;
  race?: string;
  background?: string;
  alignment: string;
  templateId: string;
  templateName: string;
  statBlock: StatBlock;
  backstory: Backstory;
  worldId?: string | null;
  hiddenFromParty: boolean;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface World {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateRequest {
  kind?: CharacterKind | "random";
  race?: string;
  templateId?: string;
  challengeRating?: string;
  background?: string;
  alignment?: string;
  name?: string;
  fullyRandom?: boolean;
}

export interface GeneratedCharacter {
  kind: CharacterKind;
  name: string;
  race?: string;
  background?: string;
  alignment: string;
  templateId: string;
  templateName: string;
  statBlock: StatBlock;
  backstory: Backstory;
}

export interface GeneratedItem {
  name: string;
  itemType: string;
  category: string;
  rarity: string;
  description: string;
  property: string;
  history: string;
}

export interface Item extends GeneratedItem {
  id: string;
  userId: string;
  worldId?: string | null;
  hiddenFromParty: boolean;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateItemRequest {
  category?: string;
  rarity?: string;
  name?: string;
  fullyRandom?: boolean;
}

export interface GeneratedLocation {
  name: string;
  locationType: string;
  category: string;
  description: string;
  notableFeature: string;
  keeper: string;
  rumor: string;
}

export interface Location extends GeneratedLocation {
  id: string;
  userId: string;
  worldId?: string | null;
  hiddenFromParty: boolean;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateLocationRequest {
  category?: string;
  name?: string;
  fullyRandom?: boolean;
}

export interface GeneratedQuestHook {
  title: string;
  questType: string;
  tier: string;
  hook: string;
  objective: string;
  complication: string;
  reward: string;
}

export const QUEST_STATUSES = ["active", "completed", "failed", "abandoned"] as const;
export type QuestStatus = typeof QUEST_STATUSES[number];
export const QUEST_STATUS_LABELS: Record<QuestStatus, string> = {
  active: "Active",
  completed: "Completed",
  failed: "Failed",
  abandoned: "Abandoned",
};

export interface QuestHook extends GeneratedQuestHook {
  id: string;
  userId: string;
  status: QuestStatus;
  worldId?: string | null;
  hiddenFromParty: boolean;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateQuestHookRequest {
  questType?: string;
  tier?: string;
  title?: string;
  fullyRandom?: boolean;
}

export interface GeneratedFaction {
  name: string;
  factionType: string;
  agenda: string;
  methods: string;
  publicFace: string;
  hook: string;
}

export interface Faction extends GeneratedFaction {
  id: string;
  userId: string;
  worldId?: string | null;
  hiddenFromParty: boolean;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerCharacterInput {
  name: string;
  className: string;
  level: number;
  race: string;
  armorClass: number;
  maxHp: number;
  abilityScores: AbilityScores;
  playerName?: string;
}

export interface PlayerCharacter extends PlayerCharacterInput {
  id: string;
  userId: string;
  worldId?: string | null;
  hiddenFromParty: boolean;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateFactionRequest {
  factionType?: string;
  name?: string;
  fullyRandom?: boolean;
}

export interface EncounterTableEntry {
  roll: string;
  description: string;
}

export interface GeneratedEncounterTable {
  name: string;
  terrain: string;
  entries: EncounterTableEntry[];
}

export interface EncounterTable extends GeneratedEncounterTable {
  id: string;
  userId: string;
  worldId?: string | null;
  hiddenFromParty: boolean;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateEncounterTableRequest {
  terrain?: string;
  name?: string;
  fullyRandom?: boolean;
}

export interface SessionNoteInput {
  title: string;
  sessionLabel?: string;
  sessionDate?: string;
  summary: string;
  looseThreads?: string;
  nextSteps?: string;
}

export interface SessionNote extends SessionNoteInput {
  id: string;
  userId: string;
  worldId?: string | null;
  hiddenFromParty: boolean;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RollLogEntryInput {
  worldId: string;
  rollerName: string;
  notation: string;
  results: number[];
  modifier: number;
  total: number;
  mode?: "adv" | "dis";
  label?: string;
  hiddenFromParty?: boolean;
}

export interface RollLogEntry extends RollLogEntryInput {
  id: string;
  userId: string;
  hiddenFromParty: boolean;
  createdAt: string;
}

export type LedgerEntryKind = "gold" | "item";

export interface LedgerEntryInput {
  worldId: string;
  kind: LedgerEntryKind;
  label: string;
  amount: number;
  authorName: string;
}

export interface LedgerEntry extends LedgerEntryInput {
  id: string;
  userId: string;
  createdAt: string;
}

export interface LedgerItemTotal {
  label: string;
  quantity: number;
}

export interface LedgerSummary {
  worldId: string;
  gold: number;
  items: LedgerItemTotal[];
  entries: LedgerEntry[];
}

export type CombatantKind = "monster" | "playerCharacter" | "custom";
export type HpStatus = "healthy" | "injured" | "bloodied" | "nearDeath" | "down";

export interface LiveCombatant {
  id: string;
  name: string;
  kind: CombatantKind;
  initiative: number;
  maxHp?: number;
  currentHp?: number;
  hpStatus: HpStatus;
  armorClass?: number;
  conditions: string[];
  notes: string;
  hpVisible: boolean;
  xp?: number;
  level?: number;
  zoneId?: string;
  hidden?: boolean;
}

export interface ZoneHazard {
  label: string;
  damage: number;
}

export interface EncounterZone {
  id: string;
  name: string;
  tags: string[];
  x: number;
  y: number;
  connections: string[];
  revealed: boolean;
  locationId?: string;
  hazard?: ZoneHazard;
}

export interface ZoneMapTemplateInput {
  name: string;
  zones: EncounterZone[];
}

export interface ZoneMapTemplate extends ZoneMapTemplateInput {
  id: string;
  userId: string;
  worldId?: string | null;
  hiddenFromParty: boolean;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EncounterZoneEffect {
  id: string;
  zoneId: string;
  label: string;
  expiresAtRound: number;
}

export interface EncounterStateInput {
  combatants: LiveCombatant[];
  round: number;
  turnIndex: number;
  zones: EncounterZone[];
  zoneEffects: EncounterZoneEffect[];
}

export interface Encounter extends EncounterStateInput {
  worldId: string;
  updatedAt: string | null;
}

export interface ActivitySummary {
  combatActivityAt: string | null;
  notesActivityAt: string | null;
  codexActivityAt: string | null;
  inventoryActivityAt: string | null;
}

export interface AdventureCastNames {
  questGiverName?: string;
  antagonistName?: string;
  startLocationName?: string;
  climaxLocationName?: string;
  rewardName?: string;
}

export interface GenerateAdventureRequest {
  tier?: string;
  title?: string;
  fullyRandom?: boolean;
  cast: AdventureCastNames;
}

export interface GeneratedAdventure {
  title: string;
  tier: string;
  premise: string;
  hook: string;
  objective: string;
  complication: string;
  reward: string;
}

export interface Adventure extends GeneratedAdventure {
  id: string;
  userId: string;
  worldId?: string | null;
  hiddenFromParty: boolean;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type EntityType = "character" | "item" | "location" | "quest" | "faction" | "encounterTable" | "sessionNote" | "adventure" | "playerCharacter" | "zoneMapTemplate";

export interface EntityTypeDef {
  type: EntityType;
  label: string;
}

export const ENTITY_TYPES: EntityTypeDef[] = [
  { type: "character", label: "Character" },
  { type: "item", label: "Item" },
  { type: "location", label: "Location" },
  { type: "quest", label: "Quest Hook" },
  { type: "faction", label: "Faction" },
  { type: "encounterTable", label: "Encounter Table" },
  { type: "sessionNote", label: "Session Note" },
  { type: "adventure", label: "Adventure" },
  { type: "playerCharacter", label: "Player Character" },
  { type: "zoneMapTemplate", label: "Zone Map Template" },
];

export interface EntityRef {
  type: EntityType;
  id: string;
  name: string;
}

export interface SearchResult extends EntityRef {
  meta: string;
  worldId?: string | null;
}

export interface EntityLink {
  id: string;
  label?: string;
  other: EntityRef;
}

export interface CodexNoteInput {
  worldId: string;
  entityType: EntityType;
  entityId: string;
  authorName: string;
  text: string;
}

export interface CodexNote extends CodexNoteInput {
  id: string;
  userId: string;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  username: string;
}

export interface SignupResult extends AuthUser {
  recoveryCode: string;
}

export interface RecoveryCodeResult {
  recoveryCode: string;
}
