import type { RulesetDefinition } from "./types.js";

// A bounded, typed set of DM-tunable overrides — deliberately NOT a
// freeform rules DSL (that's the separate, later Trigger Rules Engine).
// Each field tunes exactly one formula the base ruleset already computes,
// so a house rule is always "change a number in an existing calculation,"
// never "invent a new mechanic." Every field is optional; an absent field
// means "use the ruleset's own default."
export interface HouseRules {
  // Carry capacity = strength score × this, in lbs. 5e's default is 15
  // (see carryCapacityLbs). A "gritty" table might drop this to 10; a
  // "heroic" one might raise it to 20 or higher.
  carryCapacityMultiplier?: number;
  // Point-buy budget for the Character Creation wizard's Point Buy mode.
  // 5e's default is 27 (see POINT_BUY_BUDGET). Lower for a grittier,
  // less powerful party; raise for a more heroic one.
  pointBuyBudget?: number;
  // Multiplies all four XP thresholds (easy/medium/hard/deadly) computed
  // by computeEncounterDifficulty, before rating the encounter. >1 makes
  // every encounter read as easier than the stock math would rate it
  // (the party can absorb more before crossing into "hard"/"deadly");
  // <1 makes encounters read as harder.
  encounterDifficultyMultiplier?: number;
}

export const DEFAULT_HOUSE_RULES: HouseRules = {};

// Wraps a base RulesetDefinition with a world's house rules, returning a
// new RulesetDefinition — callers never need to know whether house rules
// are in play, they just call the returned ruleset's methods normally.
export function applyHouseRules(ruleset: RulesetDefinition, houseRules: HouseRules): RulesetDefinition {
  if (!houseRules || Object.keys(houseRules).length === 0) return ruleset;

  return {
    ...ruleset,
    pointBuyBudget: houseRules.pointBuyBudget ?? ruleset.pointBuyBudget,
    carryCapacityLbs: (strengthScore: number) =>
      Math.max(0, strengthScore) * (houseRules.carryCapacityMultiplier ?? 15),
    computeEncounterDifficulty: (combatants) => {
      const base = ruleset.computeEncounterDifficulty(combatants);
      if (!base) return null;
      const multiplier = houseRules.encounterDifficultyMultiplier ?? 1;
      if (multiplier === 1) return base;

      const thresholds = {
        easy: Math.round(base.thresholds.easy * multiplier),
        medium: Math.round(base.thresholds.medium * multiplier),
        hard: Math.round(base.thresholds.hard * multiplier),
        deadly: Math.round(base.thresholds.deadly * multiplier),
      };
      const rating =
        base.adjustedXp >= thresholds.deadly ? "deadly" :
        base.adjustedXp >= thresholds.hard ? "hard" :
        base.adjustedXp >= thresholds.medium ? "medium" :
        base.adjustedXp >= thresholds.easy ? "easy" : "trivial";

      return { rating, adjustedXp: base.adjustedXp, thresholds };
    },
  };
}
