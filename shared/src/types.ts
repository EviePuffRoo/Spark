import type { ParsedAttack } from "./statBlockAttacks.js";

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
  equippedItems: string[];
  attunedItems: string[];
  createdAt: string;
  updatedAt: string;
}

export interface World {
  id: string;
  name: string;
  description?: string;
  nextSessionAt?: string;
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

export type ItemBonusType =
  | "none"
  | "attackAndDamage"
  | "armorClass"
  | "savingThrows"
  | "abilityChecks"
  | "spellSaveDc";

export interface GeneratedItem {
  name: string;
  itemType: string;
  category: string;
  rarity: string;
  rarityTier: number;
  description: string;
  property: string;
  history: string;
  bonusType: ItemBonusType;
  bonusValue: number;
  requiresAttunement: boolean;
  charges: number | null;
  rechargeRule: string | null;
  value: number;
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
  settlementId?: string | null;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedRegion {
  name: string;
  terrainCategory: string;
  dangerLevel?: string;
  description: string;
}

export interface Region extends GeneratedRegion {
  id: string;
  userId: string;
  worldId?: string | null;
  hiddenFromParty: boolean;
  x: number;
  y: number;
  connections: string[];
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateRegionRequest {
  terrainCategory?: string;
  fullyRandom?: boolean;
}

export interface GeneratedSettlement {
  name: string;
  settlementType: string;
  population?: string;
  government?: string;
  description: string;
}

export interface Settlement extends GeneratedSettlement {
  id: string;
  userId: string;
  worldId?: string | null;
  hiddenFromParty: boolean;
  regionId?: string | null;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateSettlementRequest {
  settlementType?: string;
  fullyRandom?: boolean;
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
  reputation: number;
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

export interface DeathSaves {
  successes: number;
  failures: number;
}

export interface SpellSlotLevel {
  level: number;
  max: number;
  current: number;
}

export interface ClassResource {
  name: string;
  max: number;
  current: number;
  rechargeOn: "short" | "long";
}

export interface GeneratedPlayerCharacter extends PlayerCharacterInput {
  spellSlots: SpellSlotLevel[];
  classResources: ClassResource[];
}

export interface PlayerCharacter extends PlayerCharacterInput {
  id: string;
  userId: string;
  worldId?: string | null;
  hiddenFromParty: boolean;
  tags: string[];
  notes?: string;
  equippedItems: string[];
  attunedItems: string[];
  currentHp: number;
  deathSaves: DeathSaves;
  spellSlots: SpellSlotLevel[];
  preparedSpells: string[];
  classResources: ClassResource[];
  conditions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GeneratePlayerCharacterRequest {
  className?: string;
  race?: string;
  level?: number;
  fullyRandom?: boolean;
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

export interface ChatMessageInput {
  worldId: string;
  text: string;
}

export interface ChatMessage {
  id: string;
  worldId: string;
  userId: string;
  senderName: string;
  text: string;
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

export const DOWNTIME_ACTIVITY_TYPES = ["training", "crafting", "carousing", "research", "recovery", "custom"] as const;
export type DowntimeActivityType = typeof DOWNTIME_ACTIVITY_TYPES[number];
export const DOWNTIME_ACTIVITY_TYPE_LABELS: Record<DowntimeActivityType, string> = {
  training: "Training",
  crafting: "Crafting",
  carousing: "Carousing",
  research: "Research",
  recovery: "Recovery",
  custom: "Custom",
};

export interface DowntimeActivityInput {
  worldId: string;
  playerCharacterId?: string;
  characterName: string;
  activityType: DowntimeActivityType;
  description: string;
  daysSpent: number;
  outcome?: string;
}

export interface DowntimeActivity extends DowntimeActivityInput {
  id: string;
  userId: string;
  createdAt: string;
}

export type CombatantKind = "monster" | "playerCharacter" | "custom";
export type HpStatus = "healthy" | "injured" | "bloodied" | "nearDeath" | "down";

export interface LiveCombatantCondition {
  name: string;
  // Absolute round number the condition lapses at (matches EncounterZoneEffect's
  // expiresAtRound convention below), or null for a duration the DM clears by hand.
  expiresAtRound: number | null;
}

export interface LiveCombatant {
  id: string;
  name: string;
  kind: CombatantKind;
  initiative: number;
  maxHp?: number;
  currentHp?: number;
  hpStatus: HpStatus;
  armorClass?: number;
  conditions: LiveCombatantCondition[];
  notes: string;
  hpVisible: boolean;
  xp?: number;
  level?: number;
  zoneId?: string;
  hidden?: boolean;
  equipmentAcBonus?: number;
  playerCharacterId?: string;
  // Snapshotted from the source Character's stat block when added to combat
  // (see parseStatBlockAttacks) — not looked up live, same as maxHp/armorClass,
  // so combat state survives the source NPC/monster being edited or deleted.
  attacks?: ParsedAttack[];
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

export interface DungeonExit {
  zoneId: string;
  toRoomId: string;
  label?: string;
}

export interface DungeonRoomRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DungeonRoom {
  id: string;
  name: string;
  templateId: string;
  exits: DungeonExit[];
  rect?: DungeonRoomRect;
}

export interface DungeonInput {
  name: string;
  rooms: DungeonRoom[];
}

export interface Dungeon extends DungeonInput {
  id: string;
  userId: string;
  worldId?: string | null;
  hiddenFromParty: boolean;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateDungeonRequest {
  roomCount?: number;
  fullyRandom?: boolean;
}

// A pure, unpersisted outline — roomId/zoneId and every exit are already
// final (client-generated ids are honored verbatim on save, same as
// everywhere else in this app), but each room still needs a real
// ZoneMapTemplate created for it before a Dungeon record referencing it
// can be saved, so `templateId` is filled in afterward at save time.
export interface GeneratedDungeonRoomOutline {
  roomId: string;
  zoneId: string;
  name: string;
  hazard?: ZoneHazard;
  exits: DungeonExit[];
}

export interface GeneratedDungeonOutline {
  name: string;
  rooms: GeneratedDungeonRoomOutline[];
}

export interface ShopStockEntry {
  id: string;
  itemId: string;
  itemName: string;
  price: number;
  quantity: number; // -1 = unlimited
}

export interface ShopInput {
  name: string;
  description?: string;
  stock: ShopStockEntry[];
}

export interface Shop extends ShopInput {
  id: string;
  userId: string;
  worldId?: string | null;
  hiddenFromParty: boolean;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateShopRequest {
  archetype?: string;
  stockSize?: number;
  fullyRandom?: boolean;
}

export interface GeneratedShop {
  name: string;
  description: string;
  stock: ShopStockEntry[];
}

export interface EncounterStateInput {
  combatants: LiveCombatant[];
  round: number;
  turnIndex: number;
  zones: EncounterZone[];
  zoneEffects: EncounterZoneEffect[];
  activeDungeonId?: string;
  activeDungeonRoomId?: string;
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

export type EntityType = "character" | "item" | "location" | "quest" | "faction" | "encounterTable" | "sessionNote" | "adventure" | "playerCharacter" | "zoneMapTemplate" | "dungeon" | "shop" | "region" | "settlement";

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
  { type: "dungeon", label: "Dungeon" },
  { type: "shop", label: "Shop" },
  { type: "region", label: "Region" },
  { type: "settlement", label: "Settlement" },
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

export interface PublicGalleryEntry {
  id: string;
  entityType: EntityType;
  entityId: string;
  title: string;
  description?: string;
  name: string;
  meta: string;
  publisherUsername: string;
  publishedAt: string;
}

export interface PublishEntryInput {
  entityType: EntityType;
  entityId: string;
  title: string;
  description?: string;
}

export type GalleryReportReason = "spam" | "offensive" | "copyright" | "other";

export interface GalleryReportDTO {
  id: string;
  reason: GalleryReportReason;
  detail?: string;
  status: string;
  reporterUsername: string;
  createdAt: string;
}

export interface ModerationQueueEntry {
  id: string;
  entityType: EntityType;
  entityId: string;
  title: string;
  name: string;
  publisherUsername: string;
  publisherId: string;
  publishedAt: string;
  reportCount: number;
  reports: GalleryReportDTO[];
}

export interface AdminUserSummary {
  id: string;
  username: string;
  tier: string;
  role: string;
  canPublish: boolean;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  freeUsers: number;
  paidUsers: number;
  signupsLast7Days: number;
  signupsLast30Days: number;
  totalWorlds: number;
  starterWorldsCreated: number;
}

export interface SessionHighlightRoll {
  rollerName: string;
  notation: string;
  total: number;
  label: string | null;
  createdAt: string;
}

export interface SessionHighlights {
  worldId: string;
  since: string;
  rollCount: number;
  messageCount: number;
  naturalTwenties: SessionHighlightRoll[];
  naturalOnes: SessionHighlightRoll[];
  topRolls: SessionHighlightRoll[];
  goldDelta: number;
  itemsGained: { label: string; quantity: number }[];
  // Most rolls logged in the period, not highest total — deliberately kept
  // separate from topRolls so this never gets read as "who did the most
  // damage" (roll log entries include checks/saves/initiative too, not
  // only damage rolls).
  mostActiveRoller: { rollerName: string; rollCount: number } | null;
  questsCompleted: { title: string }[];
}

export type AchievementCategory = "dice" | "quests" | "economy" | "social" | "legacy";

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  // Omitted for one-off achievements (effectively a target of 1) — set
  // only when there's a meaningful count to show progress toward.
  target?: number;
}

export interface AchievementProgress {
  id: string;
  unlocked: boolean;
  current: number;
  target: number;
}

export interface WorldAchievements {
  worldId: string;
  unlockedCount: number;
  totalCount: number;
  progress: AchievementProgress[];
}

export type BaseUpgradeCategory = "defenses" | "trade" | "influence" | "comfort";

export interface BaseUpgradeDef {
  id: string;
  name: string;
  description: string;
  category: BaseUpgradeCategory;
  cost: number;
  // All of these must already be acquired before this upgrade is purchasable.
  prerequisiteIds?: string[];
  // At most one upgrade sharing a group can ever be acquired for a given
  // base — the party's branching, mutually-exclusive choices (allying with
  // one faction over another, stone walls vs. a hedge maze, ...).
  exclusiveGroup?: string;
}

export interface BaseState {
  worldId: string;
  name: string;
  // Derived from the number of upgrades acquired, not stored separately —
  // one fewer place for the count to drift out of sync.
  level: number;
  gold: number;
  isPaid: boolean;
  acquiredUpgradeIds: string[];
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
  displayName: string | null;
  tier: string;
  role: string;
}

export interface SignupResult extends AuthUser {
  recoveryCode: string;
}

export interface RecoveryCodeResult {
  recoveryCode: string;
}
