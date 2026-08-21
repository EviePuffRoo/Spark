import { describe, it, expect } from "vitest";
import type { Encounter, LiveCombatant, EncounterZone } from "@spark/shared";
import { filterEncounterForDisplay } from "./encounterRedaction";

function combatant(overrides: Partial<LiveCombatant> = {}): LiveCombatant {
  return {
    id: "c1",
    name: "Goblin",
    kind: "monster",
    initiative: 10,
    maxHp: 7,
    currentHp: 7,
    hpStatus: "healthy",
    conditions: [],
    notes: "",
    hpVisible: true,
    xp: 50,
    ...overrides,
  };
}

function zone(overrides: Partial<EncounterZone> = {}): EncounterZone {
  return {
    id: "z1",
    name: "Entry Hall",
    tags: [],
    x: 0,
    y: 0,
    connections: [],
    revealed: true,
    ...overrides,
  };
}

function baseEncounter(overrides: Partial<Encounter> = {}): Encounter {
  return {
    worldId: "w1",
    updatedAt: null,
    combatants: [],
    round: 1,
    turnIndex: 0,
    zones: [],
    zoneEffects: [],
    ...overrides,
  };
}

describe("filterEncounterForDisplay", () => {
  it("drops hidden combatants", () => {
    const encounter = baseEncounter({ combatants: [combatant({ id: "visible" }), combatant({ id: "hidden", hidden: true })] });
    const result = filterEncounterForDisplay(encounter);
    expect(result.combatants.map((c) => c.id)).toEqual(["visible"]);
  });

  it("strips HP for combatants with hpVisible false, keeps it for others", () => {
    const encounter = baseEncounter({
      combatants: [
        combatant({ id: "shown", hpVisible: true, currentHp: 5, maxHp: 10 }),
        combatant({ id: "concealed", hpVisible: false, currentHp: 5, maxHp: 10 }),
      ],
    });
    const [shown, concealed] = filterEncounterForDisplay(encounter).combatants;
    expect(shown.currentHp).toBe(5);
    expect(shown.maxHp).toBe(10);
    expect(concealed.currentHp).toBeUndefined();
    expect(concealed.maxHp).toBeUndefined();
  });

  it("always strips xp regardless of visibility", () => {
    const encounter = baseEncounter({ combatants: [combatant({ xp: 100 })] });
    expect(filterEncounterForDisplay(encounter).combatants[0].xp).toBeUndefined();
  });

  it("only includes revealed zones, and prunes connections pointing to unrevealed ones", () => {
    const encounter = baseEncounter({
      zones: [
        zone({ id: "revealed", revealed: true, connections: ["hidden-room", "revealed"] }),
        zone({ id: "hidden-room", revealed: false }),
      ],
    });
    const result = filterEncounterForDisplay(encounter);
    expect(result.zones.map((z) => z.id)).toEqual(["revealed"]);
    expect(result.zones[0].connections).toEqual(["revealed"]);
  });

  it("drops a combatant assigned to an unrevealed zone", () => {
    const encounter = baseEncounter({
      zones: [zone({ id: "hidden-room", revealed: false })],
      combatants: [combatant({ id: "in-hidden-room", zoneId: "hidden-room" })],
    });
    expect(filterEncounterForDisplay(encounter).combatants).toHaveLength(0);
  });

  it("drops a non-PC combatant outside the given visibleCells, but keeps one inside it", () => {
    const encounter = baseEncounter({
      combatants: [
        combatant({ id: "in-sight", kind: "monster", gridX: 2, gridY: 2 }),
        combatant({ id: "out-of-sight", kind: "monster", gridX: 9, gridY: 9 }),
      ],
    });
    const result = filterEncounterForDisplay(encounter, new Set(["2,2"]));
    expect(result.combatants.map((c) => c.id)).toEqual(["in-sight"]);
  });

  it("never fog-gates a playerCharacter combatant, even outside visibleCells", () => {
    const encounter = baseEncounter({
      combatants: [combatant({ id: "pc", kind: "playerCharacter", gridX: 9, gridY: 9 })],
    });
    const result = filterEncounterForDisplay(encounter, new Set(["0,0"]));
    expect(result.combatants.map((c) => c.id)).toEqual(["pc"]);
  });

  it("does not fog-gate anything when visibleCells is omitted", () => {
    const encounter = baseEncounter({
      combatants: [combatant({ id: "unplaced", kind: "monster", gridX: 9, gridY: 9 })],
    });
    expect(filterEncounterForDisplay(encounter).combatants.map((c) => c.id)).toEqual(["unplaced"]);
  });

  it("drops expired zone effects and effects in unrevealed zones", () => {
    const encounter = baseEncounter({
      round: 5,
      zones: [zone({ id: "visible", revealed: true })],
      zoneEffects: [
        { id: "e1", zoneId: "visible", label: "Fog", expiresAtRound: 10 },
        { id: "e2", zoneId: "visible", label: "Stale fog", expiresAtRound: 2 },
        { id: "e3", zoneId: "unrevealed-zone", label: "Hidden fog", expiresAtRound: 10 },
      ],
    });
    const result = filterEncounterForDisplay(encounter);
    expect(result.zoneEffects.map((e) => e.id)).toEqual(["e1"]);
  });
});
