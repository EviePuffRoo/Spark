import type { LiveCombatant } from "../types.js";

export type DifficultyRating = "trivial" | "easy" | "medium" | "hard" | "deadly";

export interface DifficultyResult {
  rating: DifficultyRating;
  adjustedXp: number;
  thresholds: { easy: number; medium: number; hard: number; deadly: number };
}

// The contract a game system must satisfy to plug into Spark's generators
// and character sheets in place of the built-in D&D 5e ruleset — see
// dnd5e/index.ts for the reference implementation. Widen this interface
// incrementally as more 5e-specific logic (CR/XP tables, class/spell
// data, stat-block field schemas) gets pulled out of the generators and
// views that currently hardcode it — see the "Ruleset Plugin System"
// architecture scope for the intended end state. Every addition here
// needs a matching value on dnd5eRuleset before anything can consume it.
export interface RulesetDefinition {
  id: string;
  name: string;
  abilityModifier(score: number): number;
  formatModifier(score: number): string;
  proficiencyBonusForLevel(level: number): number;
  carryCapacityLbs(strengthScore: number): number;
  // Point-buy budget for ability-score assignment during character
  // creation — a plain tunable number rather than a function, since
  // there's no per-level or per-score variation to compute.
  pointBuyBudget: number;
  computeEncounterDifficulty(combatants: LiveCombatant[]): DifficultyResult | null;
}
