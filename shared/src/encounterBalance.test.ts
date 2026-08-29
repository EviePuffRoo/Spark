import { describe, it, expect } from "vitest";
import { analyzeEncounterBalance } from "./encounterBalance.js";
import type { LiveCombatant, ParsedAttack } from "./types.js";

function pc(overrides: Partial<LiveCombatant> = {}): LiveCombatant {
  return {
    id: "pc1", name: "Aria", kind: "playerCharacter", initiative: 15,
    hpStatus: "healthy", conditions: [], notes: "", hpVisible: true,
    maxHp: 30, currentHp: 30, armorClass: 16,
    ...overrides,
  };
}

function attack(overrides: Partial<ParsedAttack> = {}): ParsedAttack {
  return { name: "Bite", toHitBonus: 4, damageDice: "1d6+2", damageType: "piercing", savingThrow: null, ...overrides };
}

function monster(overrides: Partial<LiveCombatant> = {}): LiveCombatant {
  return {
    id: "m1", name: "Goblin", kind: "monster", initiative: 10,
    hpStatus: "healthy", conditions: [], notes: "", hpVisible: true,
    maxHp: 7, currentHp: 7,
    ...overrides,
  };
}

describe("analyzeEncounterBalance", () => {
  it("counts party and monsters separately", () => {
    const report = analyzeEncounterBalance([pc(), pc({ id: "pc2" }), monster()]);
    expect(report.partyCount).toBe(2);
    expect(report.monsterCount).toBe(1);
    expect(report.actionEconomyRatio).toBe(0.5);
    expect(report.partyOutnumbered).toBe(false);
  });

  it("flags the party as outnumbered past the 1.5x ratio", () => {
    const report = analyzeEncounterBalance([
      pc(),
      monster({ id: "m1" }), monster({ id: "m2" }), monster({ id: "m3" }),
    ]);
    expect(report.actionEconomyRatio).toBe(3);
    expect(report.partyOutnumbered).toBe(true);
  });

  it("does not flag outnumbered at or below the threshold", () => {
    const report = analyzeEncounterBalance([pc(), pc({ id: "pc2" }), monster(), monster({ id: "m2" }), monster({ id: "m3" })]);
    expect(report.actionEconomyRatio).toBe(1.5);
    expect(report.partyOutnumbered).toBe(false);
  });

  it("returns a null ratio and unflagged outnumbered with no party", () => {
    const report = analyzeEncounterBalance([monster()]);
    expect(report.actionEconomyRatio).toBeNull();
    expect(report.partyOutnumbered).toBe(false);
  });

  it("sums party and monster HP pools", () => {
    const report = analyzeEncounterBalance([pc({ currentHp: 20, maxHp: 30 }), monster({ currentHp: 5, maxHp: 7 })]);
    expect(report.partyTotalHp).toBe(20);
    expect(report.monsterTotalHp).toBe(5);
  });

  it("falls back to maxHp when currentHp is unset", () => {
    const report = analyzeEncounterBalance([pc({ currentHp: undefined, maxHp: 30 })]);
    expect(report.partyTotalHp).toBe(30);
  });

  it("computes expected damage per round from a to-hit attack against the party's average AC", () => {
    // toHitBonus +4 vs AC 16 needs a 12+, a 45% hit chance; 1d6+2 averages 5.5.
    const report = analyzeEncounterBalance([pc({ armorClass: 16 }), monster({ attacks: [attack()] })]);
    expect(report.expectedDamagePerRound).toBeCloseTo(5.5 * 0.45, 1);
  });

  it("computes expected damage from a save-based attack using the flat assumed save chance", () => {
    const report = analyzeEncounterBalance([
      pc(),
      monster({ attacks: [attack({ toHitBonus: null, damageDice: "2d6", savingThrow: { ability: "dex", dc: 13 } })] }),
    ]);
    // 2d6 averages 7; assumed 50% save success means 50% of that lands.
    expect(report.expectedDamagePerRound).toBeCloseTo(3.5, 1);
  });

  it("is zero when monsters have no parsed attacks", () => {
    const report = analyzeEncounterBalance([pc(), monster({ attacks: [] })]);
    expect(report.expectedDamagePerRound).toBe(0);
    expect(report.roundsUntilPartyDowned).toBeNull();
  });

  it("computes rounds until the party is downed", () => {
    const report = analyzeEncounterBalance([
      pc({ currentHp: 20, armorClass: 10 }),
      monster({ attacks: [attack({ toHitBonus: 10, damageDice: "1d1" })] }),
    ]);
    // AC 10 vs +10 to hit is a guaranteed (capped 95%) hit for ~1 damage/round.
    expect(report.expectedDamagePerRound).toBeGreaterThan(0);
    expect(report.roundsUntilPartyDowned).toBe(Math.floor(20 / report.expectedDamagePerRound));
  });

  it("ignores an unparseable damage notation", () => {
    const report = analyzeEncounterBalance([pc(), monster({ attacks: [attack({ damageDice: "a lot" })] })]);
    expect(report.expectedDamagePerRound).toBe(0);
  });
});
