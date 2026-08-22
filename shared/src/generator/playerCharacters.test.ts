import { describe, it, expect } from "vitest";
import { computeLevelUpChanges, computeSpellSlots, computeClassResource } from "./playerCharacters.js";
import { PC_CLASSES, levelForXp, XP_THRESHOLDS, PC_PROFICIENCY_BONUS_BY_LEVEL } from "../data/classes.js";

const FIGHTER = PC_CLASSES.find((c) => c.id === "fighter")!;
const WIZARD = PC_CLASSES.find((c) => c.id === "wizard")!;

describe("levelForXp", () => {
  it("returns level 1 for 0 xp", () => {
    expect(levelForXp(0)).toBe(1);
  });

  it("returns the highest level whose threshold the xp meets or exceeds", () => {
    expect(levelForXp(299)).toBe(1);
    expect(levelForXp(300)).toBe(2);
    expect(levelForXp(899)).toBe(2);
    expect(levelForXp(900)).toBe(3);
  });

  it("caps at level 20 for the top threshold and beyond", () => {
    expect(levelForXp(XP_THRESHOLDS[19])).toBe(20);
    expect(levelForXp(999999)).toBe(20);
  });
});

describe("computeLevelUpChanges", () => {
  it("computes an incremental HP gain, not a from-scratch total", () => {
    const conMod = 2;
    const changes = computeLevelUpChanges(FIGHTER, 1, 2, conMod);
    // Fighter hit die 10: perLevelAverage = floor(10/2)+1+conMod = 8, one level gained.
    expect(changes.hpGain).toBe(8);
    expect(changes.classMatched).toBe(true);
  });

  it("scales hpGain with the number of levels gained", () => {
    const singleLevel = computeLevelUpChanges(FIGHTER, 4, 5, 2);
    const threeLevels = computeLevelUpChanges(FIGHTER, 4, 7, 2);
    expect(threeLevels.hpGain).toBe(singleLevel.hpGain * 3);
  });

  it("refreshes spell slots and the class resource to their new-level full values", () => {
    const changes = computeLevelUpChanges(WIZARD, 2, 3, 3);
    expect(changes.spellSlots).toEqual(computeSpellSlots(WIZARD, 3));
    for (const slot of changes.spellSlots) expect(slot.current).toBe(slot.max);
  });

  it("returns the new level's proficiency bonus from PC_PROFICIENCY_BONUS_BY_LEVEL", () => {
    const changes = computeLevelUpChanges(FIGHTER, 4, 5, 1);
    expect(changes.proficiencyBonus).toBe(PC_PROFICIENCY_BONUS_BY_LEVEL[4]);
  });

  it("falls back to a flat d8 hit die and skips spell/resource recompute when the class isn't recognized", () => {
    const changes = computeLevelUpChanges(undefined, 1, 2, 2);
    expect(changes.classMatched).toBe(false);
    expect(changes.spellSlots).toEqual([]);
    expect(changes.classResource).toBeUndefined();
    // d8 fallback: perLevelAverage = floor(8/2)+1+2 = 7.
    expect(changes.hpGain).toBe(7);
  });

  it("still returns a proficiency bonus even with an unrecognized class", () => {
    const changes = computeLevelUpChanges(undefined, 4, 5, 1);
    expect(changes.proficiencyBonus).toBe(PC_PROFICIENCY_BONUS_BY_LEVEL[4]);
  });

  it("gives a barbarian (with a class resource) an updated resource cap on level-up", () => {
    const barbarian = PC_CLASSES.find((c) => c.id === "barbarian")!;
    const changes = computeLevelUpChanges(barbarian, 1, 2, 3);
    expect(changes.classResource).toEqual(computeClassResource(barbarian, 2));
  });
});
