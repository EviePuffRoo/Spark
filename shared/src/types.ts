import type { ParsedAttack } from "./statBlockAttacks.js";
import type { SizeCategory } from "./creatureStats.js";

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
  // How this NPC currently feels about the party — reuses the exact same
  // scale and tier math as Faction.reputation (see reputation.ts) rather
  // than inventing a parallel system. Meaningful for kind:"npc"; present
  // but generally left at its default for kind:"monster" entries, which
  // don't have ongoing relationships with the party the way NPCs do.
  disposition: number;
  // Optional faction membership — coexists with disposition rather than
  // replacing it (same "coexists, doesn't replace" pattern as
  // Location.settlementId): an affiliated NPC's disposition is still a
  // fully independent, freely-adjustable value, not derived from the
  // faction's reputation. The client may offer a one-click "sync to
  // faction" convenience action, but nothing keeps the two in lockstep
  // automatically.
  factionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// An append-only history of why an NPC's disposition changed — same idea
// as the party ledger's entry list, but scoped to one Character instead
// of a whole world. Created automatically by POST
// /characters/:id/adjust-disposition; a raw PATCH of `disposition` (still
// always available, per this app's "trust the DM" convention) does not
// create one, since there's no delta/reason to record for a hand edit.
export interface DispositionLogEntry {
  id: string;
  characterId: string;
  userId: string;
  authorName: string;
  delta: number;
  reason?: string;
  createdAt: string;
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
  // Two leveling styles coexist here, same as the rest of this app's
  // "trust the DM to hand-edit anything" philosophy: a table using
  // milestone leveling just ignores xp and PATCHes level directly (as it
  // always could); a table tracking XP awards it here and calls the
  // level-up endpoint once levelForXp(xp) exceeds the stored level. Either
  // way, level-up is what actually recomputes maxHp/spellSlots/
  // classResources/proficiencyBonus together — editing level via a plain
  // PATCH (still supported) has no such side effects, exactly as before.
  xp: number;
  proficiencyBonus: number;
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
  // Links a kind:"item" entry to a real Item record (e.g. a loot drop
  // picked from the Compendium rather than typed as free text) — what
  // makes claiming it onto a specific PlayerCharacter's equippedItems
  // possible. Absent for gold entries and for quick free-text item
  // entries with no formal Item behind them; either kind still works the
  // same as before for tracking the party's shared holdings.
  itemId?: string;
}

export interface LedgerEntry extends LedgerEntryInput {
  id: string;
  userId: string;
  createdAt: string;
}

export interface LedgerItemTotal {
  label: string;
  quantity: number;
  // Present only when every entry contributing to this total (so far)
  // shares one real Item id — see LedgerEntryInput.itemId. Its presence
  // is what the client uses to decide whether to offer a Claim action.
  itemId?: string;
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
  // An Item being crafted during this activity. Purely additive: logging a
  // "crafting" activity without one still works exactly as before (free-text
  // description/outcome only). When set, the server automatically debits the
  // item's crafting cost in gold and credits one of the item to the party's
  // ledger — see computeCraftingCost.
  craftedItemId?: string;
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
  // Grid-mode position — the top-left cell of the token's footprint
  // (see SIZE_FOOTPRINT). Undefined until placed on a loaded BattleMap;
  // independent of zoneId, since a combatant can be positioned in either
  // system depending on which one the DM has loaded (they coexist).
  gridX?: number;
  gridY?: number;
  sizeCategory?: SizeCategory;
  // Feet per turn, snapshotted from the source stat block the same way
  // maxHp/armorClass are — drives movement-range highlighting on the grid.
  speedFeet?: number;
  // Sight radius in feet for the vision/fog-of-war raycast — defaults to
  // DEFAULT_VISION_RADIUS_FEET (vision.ts) when unset. Only meaningful for
  // playerCharacter tokens; fog-of-war is driven by the party's collective
  // sight, not every monster's.
  visionRadiusFeet?: number;
  // Snapshotted from the source Character's stat block when added to combat
  // (see parseStatBlockAttacks) — not looked up live, same as maxHp/armorClass,
  // so combat state survives the source NPC/monster being edited or deleted.
  attacks?: ParsedAttack[];
  // Free-text name of the spell this combatant is currently concentrating
  // on, if any. Deliberately free-text rather than a lookup into the spell
  // compendium — homebrew and reflavored spells need to work too, and this
  // is a reminder aid, not an enforced mechanic (same "trust the table"
  // stance as conditions above). Cleared automatically when the combatant
  // drops to 0 HP; taking damage while set surfaces a CON-save reminder
  // (see computeConcentrationDc) but nothing rolls or clears it for you.
  concentratingOn?: string;
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
  // A battle map to auto-load (as Encounter.activeBattleMapId) alongside
  // this room's zone template, the moment the party enters it — the
  // same "coexists, doesn't replace" relationship the zone system
  // already has with the grid system at the Encounter level.
  battleMapId?: string;
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

// A custom-crafted item ordered from a shop's artisan rather than bought
// off the shelf — the gold is paid up front (see computeCraftingCost) and
// the item sits pending until the DM marks it delivered, representing the
// in-fiction turnaround. Coexists with Shop.stock's instant buy/sell; this
// is for anything not already sitting in stock.
export interface ShopCommissionInput {
  worldId: string;
  shopId: string;
  itemId: string;
  characterName: string;
}

export interface ShopCommission extends ShopCommissionInput {
  id: string;
  userId: string;
  itemName: string;
  price: number;
  daysRequired: number;
  deliveredAt?: string;
  createdAt: string;
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
  // The BattleMap currently loaded for grid-mode combat — coexists with
  // activeDungeonId/zones rather than replacing them, same "more than one
  // map system can be live at once" model as dungeon rooms vs. zones.
  activeBattleMapId?: string;
  // "x,y" keys the party has ever seen on the current battle map — fog-of-
  // war memory. Monotonically grows: the server unions freshly-computed
  // current vision into whatever's already here on every write that could
  // move a token, so this only ever gains cells (until a new battle map is
  // loaded, which starts it fresh). A client MAY seed/extend this on PUT,
  // but never shrinks what the server already has recorded.
  exploredCells?: string[];
}

export interface Encounter extends EncounterStateInput {
  worldId: string;
  updatedAt: string | null;
  // Server-computed, response-only: the party's current-instant vision
  // (this turn's raycast, already unioned into exploredCells above) — the
  // "full brightness" cells, as opposed to exploredCells' dimmer "seen
  // before, not looking at it right now" memory. Absent/omitted for the
  // world owner, who always sees everything and has no fog to render.
  visibleCells?: string[];
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

export type EntityType = "character" | "item" | "location" | "quest" | "faction" | "encounterTable" | "sessionNote" | "adventure" | "playerCharacter" | "zoneMapTemplate" | "dungeon" | "shop" | "region" | "settlement" | "battleMap";

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
  { type: "battleMap", label: "Battle Map" },
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

// The mechanical payoff a purchased upgrade actually delivers — every
// upgrade's stated effect on the player-facing panel is generated from one
// of these, not hand-written prose, so the description can never drift out
// of sync with what the upgrade actually does. More kinds (reputation
// deltas for Influence, rest bonuses for Comfort) land in later slices;
// an upgrade with no `effect` is flavor-only for now.
export type BaseUpgradeEffect =
  | { kind: "defenseRating"; value: number }
  // Purchasing this upgrade generates and persists a real Shop (via the
  // existing shop generator) the moment it's bought — not a description of
  // one. priceMultiplier scales the generated stock's prices (< 1 = a
  // discount from a resident vendor).
  | { kind: "shopUnlock"; archetype: string; stockSize: number; priceMultiplier?: number }
  // Applies a real, immediate Faction.reputation change — value to a
  // faction the purchaser chooses at purchase time, and (for the
  // mutually-exclusive alliance upgrades) rivalValue to a second, optional
  // faction, so "gains and losses" happens in one action instead of two.
  // Both faction choices are optional: a world with no relevant faction
  // yet still lets the upgrade through, just without a delta applied.
  | { kind: "reputationDelta"; value: number; rivalValue?: number }
  // Flat HP restored on a short rest taken by any PC in this world — a
  // short rest otherwise heals 0 HP in this app (only a long rest does),
  // so this is a real gap the base fills, not a top-up on something
  // already maxed out.
  | { kind: "restBonus"; value: number };

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
  effect?: BaseUpgradeEffect;
}

export interface BaseUnlockedShop {
  upgradeId: string;
  shopId: string;
  shopName: string;
}

export interface BaseState {
  worldId: string;
  name: string;
  // Derived from the number of upgrades acquired, not stored separately —
  // one fewer place for the count to drift out of sync.
  level: number;
  gold: number;
  isPaid: boolean;
  // Sum of every acquired upgrade's defenseRating effect — a real number
  // for the DM to reference, not a description of sturdiness.
  defenseRating: number;
  acquiredUpgradeIds: string[];
  unlockedShops: BaseUnlockedShop[];
}

export type TileCategory = "terrain" | "structure" | "nature" | "hazard";

// A curated, first-party tile a DM paints onto a BattleMap grid — never an
// uploaded image. Every mechanical property a tile carries (does it block
// movement or sight, is it difficult terrain, does it hurt to stand on) is
// stated here on the tile itself, so a map's line-of-sight and movement
// rules can later be derived straight from what's actually been placed
// instead of requiring a separate manual wall-drawing pass.
export interface TileDef {
  id: string;
  name: string;
  category: TileCategory;
  blocksMovement: boolean;
  blocksVision: boolean;
  difficultTerrain: boolean;
  hazard?: ZoneHazard;
  // Radius in tiles this tile lights on its own (a torch, a lava flow) —
  // feeds the vision system once it exists. Unlit tiles omit this.
  lightRadius?: number;
}

export interface PlacedTile {
  x: number;
  y: number;
  tileId: string;
}

export const BATTLE_MAP_MAX_WIDTH = 40;
export const BATTLE_MAP_MAX_HEIGHT = 30;

export interface BattleMapInput {
  name: string;
  width: number;
  height: number;
  // Sparse — an (x,y) with no entry is bare, walkable, unlit floor.
  tiles: PlacedTile[];
}

export interface BattleMap extends BattleMapInput {
  id: string;
  userId: string;
  worldId?: string | null;
  hiddenFromParty: boolean;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// The wire shape of a live, in-progress token drag — deliberately just
// these three fields, broadcast over its own SSE event ("tokenMoved",
// distinct from the coarse "encounter" event) so every connected viewer
// can see a token glide across the grid in real time without the cost of
// a full encounter re-fetch and redaction pass on every tick. Never
// persisted; the real position only becomes durable (and shows up in the
// next "encounter" event) once the drag ends and commits via move-grid
// or the full encounter PUT.
export interface TokenMovedBroadcast {
  combatantId: string;
  gridX: number;
  gridY: number;
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
