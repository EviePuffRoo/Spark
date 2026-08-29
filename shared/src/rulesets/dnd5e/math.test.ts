import { describe, it, expect } from "vitest";
import { abilityModifier, formatModifier, proficiencyBonusForLevel, carryCapacityLbs } from "./math.js";
import { getRuleset, dnd5eRuleset } from "../index.js";
import type { LiveCombatant } from "../../types.js";

describe("abilityModifier", () => {
  it("matches the standard 5e table at both ends and around 10", () => {
    expect(abilityModifier(1)).toBe(-5);
    expect(abilityModifier(8)).toBe(-1);
    expect(abilityModifier(9)).toBe(-1);
    expect(abilityModifier(10)).toBe(0);
    expect(abilityModifier(11)).toBe(0);
    expect(abilityModifier(20)).toBe(5);
    expect(abilityModifier(30)).toBe(10);
  });
});

describe("formatModifier", () => {
  it("always shows a sign, including +0", () => {
    expect(formatModifier(10)).toBe("+0");
    expect(formatModifier(11)).toBe("+0");
    expect(formatModifier(14)).toBe("+2");
    expect(formatModifier(8)).toBe("-1");
  });
});

describe("getRuleset", () => {
  it("defaults to dnd5e with no id, and falls back to dnd5e for an unknown id", () => {
    expect(getRuleset()).toBe(dnd5eRuleset);
    expect(getRuleset("dnd5e")).toBe(dnd5eRuleset);
    expect(getRuleset("some-future-system")).toBe(dnd5eRuleset);
  });

  it("exposes proficiencyBonusForLevel and computeEncounterDifficulty", () => {
    expect(getRuleset().proficiencyBonusForLevel).toBe(proficiencyBonusForLevel);
    expect(typeof getRuleset().computeEncounterDifficulty).toBe("function");
  });
});

describe("proficiencyBonusForLevel", () => {
  it("matches the standard 5e table at the low and high ends", () => {
    expect(proficiencyBonusForLevel(1)).toBe(2);
    expect(proficiencyBonusForLevel(4)).toBe(2);
    expect(proficiencyBonusForLevel(5)).toBe(3);
    expect(proficiencyBonusForLevel(9)).toBe(4);
    expect(proficiencyBonusForLevel(13)).toBe(5);
    expect(proficiencyBonusForLevel(17)).toBe(6);
    expect(proficiencyBonusForLevel(20)).toBe(6);
  });

  it("clamps out-of-range levels to the nearest valid entry", () => {
    expect(proficiencyBonusForLevel(0)).toBe(proficiencyBonusForLevel(1));
    expect(proficiencyBonusForLevel(-5)).toBe(proficiencyBonusForLevel(1));
    expect(proficiencyBonusForLevel(99)).toBe(proficiencyBonusForLevel(20));
  });
});

describe("carryCapacityLbs", () => {
  it("matches the standard 5e rule of STR score × 15", () => {
    expect(carryCapacityLbs(10)).toBe(150);
    expect(carryCapacityLbs(18)).toBe(270);
    expect(carryCapacityLbs(8)).toBe(120);
  });

  it("never goes negative for a malformed/zero score", () => {
    expect(carryCapacityLbs(0)).toBe(0);
    expect(carryCapacityLbs(-5)).toBe(0);
  });
});

function combatant(overrides: Partial<LiveCombatant>): LiveCombatant {
  return {
    id: Math.random().toString(36), name: "Test", kind: "monster", initiative: 10,
    hpStatus: "healthy", conditions: [], notes: "", hpVisible: true,
    ...overrides,
  };
}

describe("computeEncounterDifficulty (via getRuleset)", () => {
  const compute = getRuleset().computeEncounterDifficulty;

  it("returns null when there's no party or no monsters", () => {
    expect(compute([combatant({ kind: "monster", xp: 100 })])).toBeNull();
    expect(compute([combatant({ kind: "playerCharacter", level: 3 })])).toBeNull();
    expect(compute([])).toBeNull();
  });

  it("rates a single level-1 party facing a trivial monster as trivial", () => {
    const result = compute([
      combatant({ kind: "playerCharacter", level: 1 }),
      combatant({ kind: "playerCharacter", level: 1 }),
      combatant({ kind: "playerCharacter", level: 1 }),
      combatant({ kind: "playerCharacter", level: 1 }),
      combatant({ kind: "monster", xp: 10 }),
    ]);
    expect(result).not.toBeNull();
    expect(result!.rating).toBe("trivial");
  });

  it("rates a deadly mismatch (one low-level PC vs. a high-XP monster) as deadly", () => {
    const result = compute([
      combatant({ kind: "playerCharacter", level: 1 }),
      combatant({ kind: "monster", xp: 5000 }),
    ]);
    expect(result).not.toBeNull();
    expect(result!.rating).toBe("deadly");
    expect(result!.adjustedXp).toBeGreaterThan(result!.thresholds.deadly);
  });
});
