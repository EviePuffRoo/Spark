import type { ParsedAttack } from "./statBlockAttacks.js";
import type { SizeCategory } from "./creatureStats.js";

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type AbilityScores = Record<AbilityKey, number>;

export interface StatBlockAction {
  name: string;
  description: string;
}

// A legendary action's point cost is almost always 1, but some (a dragon's
// wing attack, a vampire's bite) cost more of the creature's shared
// per-round budget — see LiveCombatant.legendaryActionsMax/Remaining below
// for how that budget is tracked once the creature is actually in combat.
export interface LegendaryAction {
  name: string;
  cost: number;
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
  // Only present on boss-tier monsters. legendaryActionsPerRound is the
  // shared point budget spent on other creatures' turns and refilled at
  // the start of this creature's own turn (see InitiativeTracker's
  // nextTurn). lairActions fire once per round, at initiative count 20,
  // for as long as the fight stays in this creature's lair — the DM
  // decides whether that's true for any given encounter, so the app just
  // surfaces the list rather than gating it on anything.
  legendaryActions?: LegendaryAction[];
  legendaryActionsPerRound?: number;
  lairActions?: StatBlockAction[];
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
export type CharacterStatus = "active" | "deceased" | "fled";

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
  // "active" | "deceased" | "fled" — set by resolving a faction battle
  // (see battleResolver.ts); every other character stays "active". Purely
  // informational: nothing currently gates on a non-"active" status.
  status: CharacterStatus;
  // Optional faction membership — coexists with disposition rather than
  // replacing it (same "coexists, doesn't replace" pattern as
  // Location.settlementId): an affiliated NPC's disposition is still a
  // fully independent, freely-adjustable value, not derived from the
  // faction's reputation. The client may offer a one-click "sync to
  // faction" convenience action, but nothing keeps the two in lockstep
  // automatically.
  factionId?: string | null;
  // Optional home settlement — a "notable NPC" tag, same loose pattern as
  // Location.settlementId/factionId above. Meaningful mostly for kind:"npc".
  settlementId?: string | null;
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
  // The in-world calendar's current day count, starting at 1 — see
  // calendar.ts's describeCalendarDay for how this becomes a readable date.
  // Advanced manually by the DM (via PATCH or /advance-day), never
  // automatically: Downtime/Travel only ever suggest a day count, since
  // auto-advancing on every logged activity would double-count when
  // multiple PCs act in parallel.
  currentDay: number;
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
  // How well the settlement is doing economically — same free-text-from-a-
  // fixed-pool convention as government/population (see PROSPERITY_LEVELS).
  prosperity?: string;
  // Reuses Region's DANGER_LEVELS pool rather than inventing a parallel
  // scale — a settlement's danger level is conceptually the same axis as
  // its surrounding region's, just independently set.
  dangerLevel?: string;
  description: string;
}

export interface Settlement extends GeneratedSettlement {
  id: string;
  userId: string;
  worldId?: string | null;
  hiddenFromParty: boolean;
  regionId?: string | null;
  // The faction that currently holds power here, if any — a loose,
  // DM-assigned tag (same "coexists, doesn't replace" pattern as
  // Character.factionId): nothing keeps a settlement's fortunes in
  // lockstep with the controlling faction's reputation automatically.
  controllingFactionId?: string | null;
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
  // The quest that must be completed before this one unlocks — a chain,
  // not a DAG (see the server's cycle check on this field).
  prerequisiteQuestId?: string | null;
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

// An append-only history of why a faction's reputation changed — the same
// idea as NPC disposition's DispositionLogEntry, closing the same gap for
// factions: created automatically by POST /factions/:id/adjust-reputation;
// a raw PATCH of `reputation` (still always available) does not create one.
export interface FactionLogEntry {
  id: string;
  factionId: string;
  userId: string;
  authorName: string;
  delta: number;
  reason?: string;
  createdAt: string;
}

export const FACTION_RELATIONSHIP_STANCES = ["ally", "rival", "war", "neutral"] as const;
export type FactionRelationshipStance = typeof FACTION_RELATIONSHIP_STANCES[number];
export const FACTION_RELATIONSHIP_STANCE_LABELS: Record<FactionRelationshipStance, string> = {
  ally: "Ally",
  rival: "Rival",
  war: "At War",
  neutral: "Neutral",
};

// An undirected stance between two factions in the same world. The server
// normalizes which faction is stored as factionAId/factionBId (lexically
// by id) so there's never a duplicate row for the same pair in the
// opposite order — callers can pass either faction first.
export interface FactionRelationshipInput {
  worldId: string;
  factionAId: string;
  factionBId: string;
  stance: FactionRelationshipStance;
  notes?: string;
}

export interface FactionRelationship extends FactionRelationshipInput {
  id: string;
  userId: string;
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

// An off-screen "world tick" a DM posts between sessions — territory
// shifts, battles, treaties, anything that happened without the party
// present. Purely a log entry (create/list/delete, no editing), the same
// shape as roll-log/downtime entries; factionId is a loose, optional tag
// (no FK) so the event's history survives that faction later being
// deleted. Surfaces on the Campaign Timeline alongside session notes,
// quests, and adventures.
export interface CampaignEventInput {
  worldId: string;
  title: string;
  description: string;
  factionId?: string;
}

export interface CampaignEvent extends CampaignEventInput {
  id: string;
  userId: string;
  createdAt: string;
}

// A single proposed change from computeWorldTickProposal (shared/src/worldTick.ts).
// One interface covers every kind rather than a discriminated union of four
// near-identical shapes, since the DM-facing diff list and the apply
// endpoint both just need "what changed, by how much, why" regardless of
// which system it touches; the fields each kind actually uses are
// documented per-kind below.
export type WorldTickProposalItemKind = "factionReputation" | "characterDisposition" | "shopStock" | "campaignEvent";

export interface WorldTickProposalItem {
  // Deterministic given the same world/day-range (see hashSeed), not
  // random — the same logical item gets the same id if the proposal is
  // recomputed, so a DM's partial approval survives a page refresh.
  id: string;
  kind: WorldTickProposalItemKind;
  // Always present: what the DM sees in the diff list.
  summary: string;
  // factionReputation: factionId + delta + reasonOrTitle (log reason).
  // characterDisposition: characterId + delta + reasonOrTitle (log reason).
  // shopStock: shopId + stockEntryId + delta (new price minus old).
  // campaignEvent: factionId (optional) + reasonOrTitle (title) + description.
  factionId?: string;
  characterId?: string;
  shopId?: string;
  stockEntryId?: string;
  delta?: number;
  reasonOrTitle?: string;
  description?: string;
}

export interface WorldTickProposal {
  worldId: string;
  fromDay: number;
  toDay: number;
  items: WorldTickProposalItem[];
}

// The DM sends back exactly the WorldTickProposalItem objects they checked
// (a subset of what GET .../proposal returned) — the same "trust the DM's
// own client for an owner-only bulk action" pattern the full encounter PUT
// already uses, rather than round-tripping item ids and recomputing.
export interface WorldTickApplyRequest {
  worldId: string;
  fromDay: number;
  toDay: number;
  items: WorldTickProposalItem[];
}

export interface WorldTickLog {
  id: string;
  worldId: string;
  fromDay: number;
  toDay: number;
  itemCount: number;
  userId: string;
  createdAt: string;
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

// The subset of activity types with a rollable outcome table (see
// data/downtimeOutcomes.ts) — everything except "crafting" (which already
// has its own item-based cost/reward flow) and "custom" (free text only,
// by design).
export const DOWNTIME_OUTCOME_ACTIVITY_TYPES = ["training", "carousing", "research", "recovery"] as const;
export type DowntimeOutcomeActivityType = typeof DOWNTIME_OUTCOME_ACTIVITY_TYPES[number];

export interface DowntimeOutcomeDef {
  id: string;
  text: string;
  // Applied to the party ledger as a gold entry when the outcome is rolled
  // and logged. Positive = the party gains gold, negative = it costs them.
  goldDelta?: number;
  // Recovery only: fraction (0-1) of the target character's missing HP
  // restored when the outcome is rolled and logged with a playerCharacterId.
  hpRestorePercent?: number;
}

export interface GenerateDowntimeOutcomeRequest {
  activityType: DowntimeOutcomeActivityType;
}

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
  // A rolled DowntimeOutcomeDef.id from data/downtimeOutcomes.ts. Purely
  // additive, same as craftedItemId: logging an activity without one still
  // works exactly as before. When set, the server looks up the outcome's
  // gold/HP effects itself (never trusting client-supplied numbers) and
  // applies them alongside the log entry.
  outcomeId?: string;
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
  // Radius in feet of light this combatant carries (a torch, a lantern,
  // a lit spell) — extends the party's fog-of-war vision from wherever
  // this token currently stands on the grid, the same "already-visible
  // cell only" rule as a tile's own lightRadius (see
  // extendWithLightSources in vision.ts). Any combatant kind can carry
  // light, not just player characters — an ally NPC or even a monster
  // holding a torch still casts real light.
  lightRadiusFeet?: number;
  // Persisted copies of the source stat block's legendary/lair data, same
  // pattern as attacks above (see the comment on ParsedAttack) — captured
  // once when the combatant is added so combat state survives the source
  // monster being edited or deleted later. legendaryActionsRemaining is
  // spent on other creatures' turns and reset to legendaryActionsMax at
  // the start of this creature's own turn.
  legendaryActionsMax?: number;
  legendaryActionsRemaining?: number;
  legendaryActionsList?: LegendaryAction[];
  // Lair actions aren't costed or numbered — at most one fires per round.
  // lairActionUsedRound records the round number it was last triggered in
  // (compared against the encounter's current round), rather than a
  // separate used/unused flag that would need its own reset step.
  lairActionsList?: StatBlockAction[];
  lairActionUsedRound?: number;
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

// Room-level memory: what's true about this room from past visits, so
// reloading it doesn't reset the dungeon to its pristine template state.
// Deliberately room-level, not per-monster — see DungeonRoom.state.
export interface DungeonRoomState {
  // No hostile combatants were alive in the encounter the last time this
  // room was left. Recomputed on every leave, so it can also un-clear if
  // the DM later adds new monsters and leaves before clearing them again.
  cleared: boolean;
  // Something fled this room instead of being defeated — set by the
  // "Flee" combatant action, distinct from Remove (defeated/dismissed).
  // Sticky: only ever set true, since a warned dungeon doesn't forget.
  alerted: boolean;
  lastVisitedDay?: number;
  // Zone ids (from this room's ZoneMapTemplate) whose hazard was cleared
  // during a past visit — reapplied (hazard stripped) on every reload so
  // a disarmed trap stays disarmed.
  disarmedHazardZoneIds: string[];
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
  state?: DungeonRoomState;
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
  // Optional settlement anchor — same "local roster" pattern as
  // Character.settlementId/Location.settlementId.
  settlementId?: string | null;
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

// The same per-world achievement computation (see achievements.ts),
// summed across every world the account owns or has joined — a career
// rollup, not a new stats system. Private to the account owner: no
// worldId, so there's nothing here for a non-owner to be denied access to.
export interface LegacyAchievements {
  worldCount: number;
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

export type TileCategory = "terrain" | "structure" | "nature" | "hazard" | "decor" | "gmOnly";

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
  // A cosmetic tile drawn on top of this cell's floor tile — a rug on
  // stone, moss over grass. Omitted (or "floor") means this placement IS
  // the cell's floor. Never consulted by vision.ts/gridMovement.ts, which
  // only ever read the floor-layer placement for a cell, so a decor tile
  // can never accidentally change a cell's movement or sight rules.
  //
  // "gmOnly" is a DM-only marker (a secret door, a trap warning) — the
  // server strips every gmOnly placement from a BattleMap before it's
  // ever sent to a viewer who isn't the map's owner (see toBattleMapDTO),
  // so this layer never reaches a player's browser at all.
  layer?: "floor" | "decor" | "gmOnly";
  // Free-text reminder for a gmOnly marker (why this door is secret, what
  // the trap does). Meaningless on any other layer.
  note?: string;
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
