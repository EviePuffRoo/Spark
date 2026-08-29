import { describe, it, expect } from "vitest";
import { evaluateTriggers } from "./triggers.js";
import type { TriggerRule, LiveCombatant } from "./types.js";

function combatant(overrides: Partial<LiveCombatant> = {}): LiveCombatant {
  return {
    id: "c1", name: "Goblin", kind: "monster", initiative: 10,
    hpStatus: "healthy", conditions: [], notes: "", hpVisible: true,
    maxHp: 20, currentHp: 20,
    ...overrides,
  };
}

function rule(overrides: Partial<TriggerRule> = {}): TriggerRule {
  return {
    id: "r1", userId: "u1", worldId: "w1", name: "Test rule",
    condition: { kind: "hpBelowPercent", threshold: 50 },
    message: "It's bloodied!",
    enabled: true,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("evaluateTriggers", () => {
  it("fires hpBelowPercent once a combatant drops at or below the threshold", () => {
    const matches = evaluateTriggers([rule()], [combatant({ currentHp: 10 })], 1);
    expect(matches).toHaveLength(1);
    expect(matches[0].combatantId).toBe("c1");
  });

  it("does not fire hpBelowPercent above the threshold", () => {
    const matches = evaluateTriggers([rule()], [combatant({ currentHp: 15 })], 1);
    expect(matches).toHaveLength(0);
  });

  it("fires hpBelowValue at or below the absolute threshold", () => {
    const r = rule({ condition: { kind: "hpBelowValue", threshold: 5 } });
    expect(evaluateTriggers([r], [combatant({ currentHp: 5 })], 1)).toHaveLength(1);
    expect(evaluateTriggers([r], [combatant({ currentHp: 6 })], 1)).toHaveLength(0);
  });

  it("fires conditionApplied on a case-insensitive substring match", () => {
    const r = rule({ condition: { kind: "conditionApplied", conditionName: "poison" } });
    const matches = evaluateTriggers([r], [combatant({ conditions: [{ name: "Poisoned", expiresAtRound: null }] })], 1);
    expect(matches).toHaveLength(1);
  });

  it("does not fire conditionApplied when no condition matches", () => {
    const r = rule({ condition: { kind: "conditionApplied", conditionName: "poison" } });
    const matches = evaluateTriggers([r], [combatant({ conditions: [{ name: "Prone", expiresAtRound: null }] })], 1);
    expect(matches).toHaveLength(0);
  });

  it("fires roundReached once the round is at or past the threshold, with no combatantId", () => {
    const r = rule({ condition: { kind: "roundReached", threshold: 3 } });
    expect(evaluateTriggers([r], [], 2)).toHaveLength(0);
    const matches = evaluateTriggers([r], [], 3);
    expect(matches).toHaveLength(1);
    expect(matches[0].combatantId).toBeUndefined();
  });

  it("keeps firing roundReached on every later round (not a one-shot edge)", () => {
    const r = rule({ condition: { kind: "roundReached", threshold: 3 } });
    expect(evaluateTriggers([r], [], 5)).toHaveLength(1);
  });

  it("filters by targetKind", () => {
    const r = rule({ condition: { kind: "hpBelowPercent", threshold: 50, targetKind: "playerCharacter" } });
    const matches = evaluateTriggers([r], [combatant({ kind: "monster", currentHp: 5 })], 1);
    expect(matches).toHaveLength(0);
  });

  it("filters by namePattern case-insensitively", () => {
    const r = rule({ condition: { kind: "hpBelowPercent", threshold: 50, namePattern: "lich" } });
    expect(evaluateTriggers([r], [combatant({ name: "Ancient Lich", currentHp: 5 })], 1)).toHaveLength(1);
    expect(evaluateTriggers([r], [combatant({ name: "Goblin", currentHp: 5 })], 1)).toHaveLength(0);
  });

  it("never fires a disabled rule", () => {
    const matches = evaluateTriggers([rule({ enabled: false })], [combatant({ currentHp: 1 })], 1);
    expect(matches).toHaveLength(0);
  });

  it("returns one match per matching combatant across multiple combatants", () => {
    const matches = evaluateTriggers(
      [rule()],
      [combatant({ id: "a", currentHp: 5 }), combatant({ id: "b", currentHp: 20 }), combatant({ id: "c", currentHp: 1 })],
      1
    );
    expect(matches.map((m) => m.combatantId).sort()).toEqual(["a", "c"]);
  });
});
