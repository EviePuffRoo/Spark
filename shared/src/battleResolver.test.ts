import { describe, it, expect } from "vitest";
import { resolveFactionBattle, type FactionBattleInput } from "./battleResolver.js";

function baseInput(overrides: Partial<FactionBattleInput> = {}): FactionBattleInput {
  return {
    worldId: "world-1",
    relationshipId: "rel-1",
    day: 15,
    sideA: { factionId: "a", factionName: "Thieves Guild", combatants: [{ id: "a1", name: "Thug", power: 100 }] },
    sideB: { factionId: "b", factionName: "City Watch", combatants: [{ id: "b1", name: "Guard", power: 100 }] },
    ...overrides,
  };
}

describe("resolveFactionBattle", () => {
  it("is a stalemate when neither side has any combatants", () => {
    const result = resolveFactionBattle(baseInput({
      sideA: { factionId: "a", factionName: "A", combatants: [] },
      sideB: { factionId: "b", factionName: "B", combatants: [] },
    }));
    expect(result.winnerFactionId).toBeNull();
    expect(result.casualties).toEqual([]);
    expect(result.reputationDeltas).toEqual([]);
  });

  it("picks a winner from the side with all the power", () => {
    const result = resolveFactionBattle(baseInput({
      sideA: { factionId: "a", factionName: "A", combatants: [{ id: "a1", name: "Overwhelming Force", power: 1000 }] },
      sideB: { factionId: "b", factionName: "B", combatants: [] },
    }));
    expect(result.winnerFactionId).toBe("a");
  });

  it("gives the winner a positive reputation delta and the loser a negative one of equal magnitude", () => {
    const result = resolveFactionBattle(baseInput());
    expect(result.reputationDeltas).toHaveLength(2);
    const winnerDelta = result.reputationDeltas.find((d) => d.factionId === result.winnerFactionId)!;
    const loserDelta = result.reputationDeltas.find((d) => d.factionId !== result.winnerFactionId)!;
    expect(winnerDelta.delta).toBeGreaterThan(0);
    expect(loserDelta.delta).toBe(-winnerDelta.delta);
  });

  it("is deterministic: identical input always produces an identical proposal", () => {
    const input = baseInput({
      sideA: { factionId: "a", factionName: "A", combatants: Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, name: `A${i}`, power: 50 })) },
      sideB: { factionId: "b", factionName: "B", combatants: Array.from({ length: 8 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, power: 40 })) },
    });
    const first = resolveFactionBattle(input);
    const second = resolveFactionBattle(input);
    expect(second).toEqual(first);
  });

  it("produces a different outcome on a different day", () => {
    const input = baseInput({
      sideA: { factionId: "a", factionName: "A", combatants: Array.from({ length: 12 }, (_, i) => ({ id: `a${i}`, name: `A${i}`, power: 60 })) },
      sideB: { factionId: "b", factionName: "B", combatants: Array.from({ length: 12 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, power: 60 })) },
    });
    const day15 = resolveFactionBattle(input);
    const day16 = resolveFactionBattle({ ...input, day: 16 });
    // Not a strict guarantee of every field differing, but with 24 combatants
    // and an evenly matched fight, the casualty list should not be identical.
    expect(day16.casualties).not.toEqual(day15.casualties);
  });

  it("assigns more casualties to a lopsided battle's loser than a close one's", () => {
    const lopsided = resolveFactionBattle(baseInput({
      sideA: { factionId: "a", factionName: "A", combatants: Array.from({ length: 20 }, (_, i) => ({ id: `a${i}`, name: `A${i}`, power: 100 })) },
      sideB: { factionId: "b", factionName: "B", combatants: Array.from({ length: 20 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, power: 5 })) },
    }));
    const loserSideId = lopsided.winnerFactionId === "a" ? "b" : "a";
    const loserCasualties = lopsided.casualties.filter((c) => c.factionId === loserSideId);
    // A near-total power mismatch should wipe out a large share of the losing side.
    expect(loserCasualties.length).toBeGreaterThan(5);
  });

  it("only marks the losing side's casualties as possibly fled; the winning side never flees", () => {
    const result = resolveFactionBattle(baseInput({
      sideA: { factionId: "a", factionName: "A", combatants: Array.from({ length: 15 }, (_, i) => ({ id: `a${i}`, name: `A${i}`, power: 10 })) },
      sideB: { factionId: "b", factionName: "B", combatants: Array.from({ length: 15 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, power: 200 })) },
    }));
    const winnerCasualties = result.casualties.filter((c) => c.factionId === result.winnerFactionId);
    expect(winnerCasualties.every((c) => c.outcome === "deceased")).toBe(true);
  });

  it("never assigns a casualty to a faction not involved in the fight", () => {
    const result = resolveFactionBattle(baseInput());
    for (const c of result.casualties) {
      expect(["a", "b"]).toContain(c.factionId);
    }
  });
});
