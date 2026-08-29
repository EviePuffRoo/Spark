import { describe, it, expect } from "vitest";
import { applyHouseRules } from "./houseRules.js";
import { dnd5eRuleset } from "./dnd5e/index.js";
import type { LiveCombatant } from "../types.js";

function combatant(overrides: Partial<LiveCombatant>): LiveCombatant {
  return {
    id: Math.random().toString(36), name: "Test", kind: "monster", initiative: 10,
    hpStatus: "healthy", conditions: [], notes: "", hpVisible: true,
    ...overrides,
  };
}

describe("applyHouseRules", () => {
  it("returns the same ruleset object when there are no overrides", () => {
    expect(applyHouseRules(dnd5eRuleset, {})).toBe(dnd5eRuleset);
  });

  it("overrides pointBuyBudget", () => {
    const ruleset = applyHouseRules(dnd5eRuleset, { pointBuyBudget: 15 });
    expect(ruleset.pointBuyBudget).toBe(15);
    expect(dnd5eRuleset.pointBuyBudget).toBe(27);
  });

  it("leaves pointBuyBudget at the base ruleset's value when not overridden", () => {
    const ruleset = applyHouseRules(dnd5eRuleset, { carryCapacityMultiplier: 20 });
    expect(ruleset.pointBuyBudget).toBe(dnd5eRuleset.pointBuyBudget);
  });

  it("overrides carryCapacityLbs's per-point multiplier", () => {
    const ruleset = applyHouseRules(dnd5eRuleset, { carryCapacityMultiplier: 10 });
    expect(ruleset.carryCapacityLbs(14)).toBe(140);
    expect(dnd5eRuleset.carryCapacityLbs(14)).toBe(210);
  });

  it("never lets carryCapacityLbs go negative for a malformed score", () => {
    const ruleset = applyHouseRules(dnd5eRuleset, { carryCapacityMultiplier: 10 });
    expect(ruleset.carryCapacityLbs(-5)).toBe(0);
  });

  it("scales all four encounter-difficulty thresholds by encounterDifficultyMultiplier", () => {
    const combatants = [
      combatant({ kind: "playerCharacter", level: 1 }),
      combatant({ kind: "monster", xp: 100 }),
    ];
    const base = dnd5eRuleset.computeEncounterDifficulty(combatants)!;
    const ruleset = applyHouseRules(dnd5eRuleset, { encounterDifficultyMultiplier: 2 });
    const scaled = ruleset.computeEncounterDifficulty(combatants)!;

    expect(scaled.thresholds.easy).toBe(Math.round(base.thresholds.easy * 2));
    expect(scaled.thresholds.deadly).toBe(Math.round(base.thresholds.deadly * 2));
    expect(scaled.adjustedXp).toBe(base.adjustedXp);
  });

  it("a >1 encounterDifficultyMultiplier can lower the rating (higher thresholds are harder to cross)", () => {
    const combatants = [
      combatant({ kind: "playerCharacter", level: 1 }),
      combatant({ kind: "monster", xp: 5000 }),
    ];
    const base = dnd5eRuleset.computeEncounterDifficulty(combatants)!;
    expect(base.rating).toBe("deadly");

    const ruleset = applyHouseRules(dnd5eRuleset, { encounterDifficultyMultiplier: 100 });
    const scaled = ruleset.computeEncounterDifficulty(combatants)!;
    expect(scaled.rating).not.toBe("deadly");
  });

  it("returns null from computeEncounterDifficulty untouched when the base ruleset returns null", () => {
    const ruleset = applyHouseRules(dnd5eRuleset, { encounterDifficultyMultiplier: 2 });
    expect(ruleset.computeEncounterDifficulty([])).toBeNull();
  });
});
