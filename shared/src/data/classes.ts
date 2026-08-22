import type { AbilityKey } from "../types.js";

export type ArmorTier = "none" | "light" | "medium" | "heavy";

// "full" follows the standard 9-level slot progression; "half" follows the
// slower half-caster progression (capped at 5th-level slots); "pact" is
// Warlock's separate short-rest-recharging Pact Magic. Non-spellcasting
// classes omit casterType/spellcastingAbility entirely.
export type CasterType = "full" | "half" | "pact";

export interface ClassResourceDef {
  name: string;
  rechargeOn: "short" | "long";
  // Indexed by level - 1 (index 0 = level 1) through level 20.
  countByLevel: number[];
}

export interface PcClassDef {
  id: string;
  name: string;
  hitDie: number;
  // All six ability keys, in this class's priority order for assigning
  // the standard array — this app's own simplification, not a strict
  // rules simulation (same spirit as encounterDifficulty.ts's XP table).
  abilityPriority: AbilityKey[];
  typicalArmor: ArmorTier;
  typicalShield: boolean;
  casterType?: CasterType;
  spellcastingAbility?: AbilityKey;
  resource?: ClassResourceDef;
}

export const PC_CLASSES: PcClassDef[] = [
  { id: "barbarian", name: "Barbarian", hitDie: 12, abilityPriority: ["str", "con", "dex", "wis", "cha", "int"], typicalArmor: "medium", typicalShield: false, resource: { name: "Rage", rechargeOn: "long", countByLevel: [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 99] } },
  { id: "bard", name: "Bard", hitDie: 8, abilityPriority: ["cha", "dex", "con", "wis", "int", "str"], typicalArmor: "light", typicalShield: false, casterType: "full", spellcastingAbility: "cha" },
  { id: "cleric", name: "Cleric", hitDie: 8, abilityPriority: ["wis", "str", "con", "cha", "dex", "int"], typicalArmor: "medium", typicalShield: true, casterType: "full", spellcastingAbility: "wis", resource: { name: "Channel Divinity", rechargeOn: "short", countByLevel: [0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3] } },
  { id: "druid", name: "Druid", hitDie: 8, abilityPriority: ["wis", "con", "dex", "int", "cha", "str"], typicalArmor: "light", typicalShield: false, casterType: "full", spellcastingAbility: "wis", resource: { name: "Wild Shape", rechargeOn: "short", countByLevel: [0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2] } },
  { id: "fighter", name: "Fighter", hitDie: 10, abilityPriority: ["str", "con", "dex", "wis", "cha", "int"], typicalArmor: "heavy", typicalShield: true, resource: { name: "Action Surge", rechargeOn: "short", countByLevel: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2] } },
  { id: "monk", name: "Monk", hitDie: 8, abilityPriority: ["dex", "wis", "con", "str", "cha", "int"], typicalArmor: "none", typicalShield: false, resource: { name: "Ki Points", rechargeOn: "short", countByLevel: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] } },
  { id: "paladin", name: "Paladin", hitDie: 10, abilityPriority: ["str", "cha", "con", "wis", "dex", "int"], typicalArmor: "heavy", typicalShield: true, casterType: "half", spellcastingAbility: "cha" },
  { id: "ranger", name: "Ranger", hitDie: 10, abilityPriority: ["dex", "wis", "con", "str", "cha", "int"], typicalArmor: "light", typicalShield: false, casterType: "half", spellcastingAbility: "wis" },
  { id: "rogue", name: "Rogue", hitDie: 8, abilityPriority: ["dex", "int", "con", "wis", "cha", "str"], typicalArmor: "light", typicalShield: false },
  { id: "sorcerer", name: "Sorcerer", hitDie: 6, abilityPriority: ["cha", "con", "dex", "wis", "int", "str"], typicalArmor: "none", typicalShield: false, casterType: "full", spellcastingAbility: "cha", resource: { name: "Sorcery Points", rechargeOn: "long", countByLevel: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] } },
  { id: "warlock", name: "Warlock", hitDie: 8, abilityPriority: ["cha", "con", "dex", "wis", "int", "str"], typicalArmor: "light", typicalShield: false, casterType: "pact", spellcastingAbility: "cha" },
  { id: "wizard", name: "Wizard", hitDie: 6, abilityPriority: ["int", "dex", "con", "wis", "cha", "str"], typicalArmor: "none", typicalShield: false, casterType: "full", spellcastingAbility: "int" },
];

// This app's own simplified starting-array convention, not a strict
// rules reprint — assigned to each class's ability priority order.
export const PC_STANDARD_ARRAY: number[] = [15, 14, 13, 12, 10, 8];

// Spell slot progressions, indexed by level - 1 (index 0 = level 1).
// Full/half caster rows are slots-by-spell-level (index 0 = 1st-level
// slots). Pact Magic (Warlock) grants fewer, same-level slots that all
// recharge on a short rest — modeled separately since it doesn't follow
// the shared multiclass slot table. This app's own simplified spellcasting
// convention, matching the SRD's well-known progressions but not modeling
// multiclassing.
export const FULL_CASTER_SLOTS: number[][] = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

export const HALF_CASTER_SLOTS: number[][] = [
  [0, 0, 0, 0, 0],
  [2, 0, 0, 0, 0],
  [3, 0, 0, 0, 0],
  [3, 0, 0, 0, 0],
  [4, 2, 0, 0, 0],
  [4, 2, 0, 0, 0],
  [4, 3, 0, 0, 0],
  [4, 3, 0, 0, 0],
  [4, 3, 2, 0, 0],
  [4, 3, 2, 0, 0],
  [4, 3, 3, 0, 0],
  [4, 3, 3, 0, 0],
  [4, 3, 3, 1, 0],
  [4, 3, 3, 1, 0],
  [4, 3, 3, 2, 0],
  [4, 3, 3, 2, 0],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2],
];

export interface PactMagicLevel {
  slotLevel: number;
  count: number;
}

export const PACT_MAGIC_SLOTS: PactMagicLevel[] = [
  { slotLevel: 1, count: 1 }, { slotLevel: 1, count: 2 }, { slotLevel: 2, count: 2 }, { slotLevel: 2, count: 2 },
  { slotLevel: 3, count: 2 }, { slotLevel: 3, count: 2 }, { slotLevel: 4, count: 2 }, { slotLevel: 4, count: 2 },
  { slotLevel: 5, count: 2 }, { slotLevel: 5, count: 2 }, { slotLevel: 5, count: 3 }, { slotLevel: 5, count: 3 },
  { slotLevel: 5, count: 3 }, { slotLevel: 5, count: 3 }, { slotLevel: 5, count: 3 }, { slotLevel: 5, count: 3 },
  { slotLevel: 5, count: 4 }, { slotLevel: 5, count: 4 }, { slotLevel: 5, count: 4 }, { slotLevel: 5, count: 4 },
];

// Standard PC proficiency-bonus-by-level progression, indexed by level - 1.
// Monster/NPC stat blocks carry their own flat proficiencyBonus field
// instead (see StatBlock) — this table is PC-specific.
export const PC_PROFICIENCY_BONUS_BY_LEVEL: number[] = [
  2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6,
];

// Standard 5e XP-to-level thresholds, indexed by level - 1 (index 0 = the
// 0 XP needed for level 1). This app's own simplified leveling convention —
// see computeLevelUpChanges in generator/playerCharacters.ts, and
// PlayerCharacter.xp/level in types.ts's doc comment for how the two
// leveling styles (XP-threshold vs. DM milestone) coexist.
export const XP_THRESHOLDS: number[] = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

// The highest level whose XP threshold the given xp total meets or
// exceeds — the level a character's accumulated xp currently qualifies
// for, independent of whatever level is actually stored (a milestone
// table may never look at this at all).
export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}
