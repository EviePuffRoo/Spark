import type { AbilityKey } from "../types.js";

export type ArmorTier = "none" | "light" | "medium" | "heavy";

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
}

export const PC_CLASSES: PcClassDef[] = [
  { id: "barbarian", name: "Barbarian", hitDie: 12, abilityPriority: ["str", "con", "dex", "wis", "cha", "int"], typicalArmor: "medium", typicalShield: false },
  { id: "bard", name: "Bard", hitDie: 8, abilityPriority: ["cha", "dex", "con", "wis", "int", "str"], typicalArmor: "light", typicalShield: false },
  { id: "cleric", name: "Cleric", hitDie: 8, abilityPriority: ["wis", "str", "con", "cha", "dex", "int"], typicalArmor: "medium", typicalShield: true },
  { id: "druid", name: "Druid", hitDie: 8, abilityPriority: ["wis", "con", "dex", "int", "cha", "str"], typicalArmor: "light", typicalShield: false },
  { id: "fighter", name: "Fighter", hitDie: 10, abilityPriority: ["str", "con", "dex", "wis", "cha", "int"], typicalArmor: "heavy", typicalShield: true },
  { id: "monk", name: "Monk", hitDie: 8, abilityPriority: ["dex", "wis", "con", "str", "cha", "int"], typicalArmor: "none", typicalShield: false },
  { id: "paladin", name: "Paladin", hitDie: 10, abilityPriority: ["str", "cha", "con", "wis", "dex", "int"], typicalArmor: "heavy", typicalShield: true },
  { id: "ranger", name: "Ranger", hitDie: 10, abilityPriority: ["dex", "wis", "con", "str", "cha", "int"], typicalArmor: "light", typicalShield: false },
  { id: "rogue", name: "Rogue", hitDie: 8, abilityPriority: ["dex", "int", "con", "wis", "cha", "str"], typicalArmor: "light", typicalShield: false },
  { id: "sorcerer", name: "Sorcerer", hitDie: 6, abilityPriority: ["cha", "con", "dex", "wis", "int", "str"], typicalArmor: "none", typicalShield: false },
  { id: "warlock", name: "Warlock", hitDie: 8, abilityPriority: ["cha", "con", "dex", "wis", "int", "str"], typicalArmor: "light", typicalShield: false },
  { id: "wizard", name: "Wizard", hitDie: 6, abilityPriority: ["int", "dex", "con", "wis", "cha", "str"], typicalArmor: "none", typicalShield: false },
];

// This app's own simplified starting-array convention, not a strict
// rules reprint — assigned to each class's ability priority order.
export const PC_STANDARD_ARRAY: number[] = [15, 14, 13, 12, 10, 8];
