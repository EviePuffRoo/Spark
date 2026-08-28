import type { AbilityKey } from "../types.js";

// SRD 5.1 skill list and per-class skill-proficiency choices (Open Game
// License content, same curated-reference posture as data/spells.ts) —
// used by the guided character-creation wizard to offer a class-appropriate
// skill picker rather than a free-text field.

export interface SkillDef {
  name: string;
  ability: AbilityKey;
}

export const SKILLS: SkillDef[] = [
  { name: "Acrobatics", ability: "dex" },
  { name: "Animal Handling", ability: "wis" },
  { name: "Arcana", ability: "int" },
  { name: "Athletics", ability: "str" },
  { name: "Deception", ability: "cha" },
  { name: "History", ability: "int" },
  { name: "Insight", ability: "wis" },
  { name: "Intimidation", ability: "cha" },
  { name: "Investigation", ability: "int" },
  { name: "Medicine", ability: "wis" },
  { name: "Nature", ability: "int" },
  { name: "Perception", ability: "wis" },
  { name: "Performance", ability: "cha" },
  { name: "Persuasion", ability: "cha" },
  { name: "Religion", ability: "int" },
  { name: "Sleight of Hand", ability: "dex" },
  { name: "Stealth", ability: "dex" },
  { name: "Survival", ability: "wis" },
];

// Which skills a class may choose proficiency in, and how many — keyed by
// the same lowercase PcClassDef id used in data/classes.ts. "choose" is
// -1 for Bard's SRD-unique "any three skills" (choices is every skill).
export interface ClassSkillChoice {
  choose: number;
  choices: string[];
}

const ALL_SKILL_NAMES = SKILLS.map((s) => s.name);

export const CLASS_SKILL_CHOICES: Record<string, ClassSkillChoice> = {
  barbarian: { choose: 2, choices: ["Animal Handling", "Athletics", "Intimidation", "Nature", "Perception", "Survival"] },
  bard: { choose: 3, choices: ALL_SKILL_NAMES },
  cleric: { choose: 2, choices: ["History", "Insight", "Medicine", "Persuasion", "Religion"] },
  druid: { choose: 2, choices: ["Arcana", "Animal Handling", "Insight", "Medicine", "Nature", "Perception", "Religion", "Survival"] },
  fighter: { choose: 2, choices: ["Acrobatics", "Animal Handling", "Athletics", "History", "Insight", "Intimidation", "Perception", "Survival"] },
  monk: { choose: 2, choices: ["Acrobatics", "Athletics", "History", "Insight", "Religion", "Stealth"] },
  paladin: { choose: 2, choices: ["Athletics", "Insight", "Intimidation", "Medicine", "Persuasion", "Religion"] },
  ranger: { choose: 3, choices: ["Animal Handling", "Athletics", "Insight", "Investigation", "Nature", "Perception", "Stealth", "Survival"] },
  rogue: { choose: 4, choices: ["Acrobatics", "Athletics", "Deception", "Insight", "Intimidation", "Investigation", "Perception", "Performance", "Persuasion", "Sleight of Hand", "Stealth"] },
  sorcerer: { choose: 2, choices: ["Arcana", "Deception", "Insight", "Intimidation", "Persuasion", "Religion"] },
  warlock: { choose: 2, choices: ["Arcana", "Deception", "History", "Intimidation", "Investigation", "Nature", "Religion"] },
  wizard: { choose: 2, choices: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Religion"] },
};

// Standard 5e point-buy: every score starts at 8 (cost 0); costs step up
// as shown, and scores above 15 aren't purchasable with points (a DM who
// wants higher starts a PC with racial bonuses or Manual entry instead).
// This app's own simplification, matching PC_STANDARD_ARRAY's own posture
// in data/classes.ts.
export const POINT_BUY_BUDGET = 27;

const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export function pointBuyCost(score: number): number {
  return POINT_BUY_COST[score] ?? Infinity;
}

export function pointBuyTotalCost(scores: Record<AbilityKey, number>): number {
  return (Object.values(scores) as number[]).reduce((sum, s) => sum + pointBuyCost(s), 0);
}
