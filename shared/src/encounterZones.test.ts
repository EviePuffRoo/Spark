import { describe, it, expect } from "vitest";
import type { EncounterStateInput, EncounterZone, LiveCombatant } from "./types.js";
import {
  addZone, updateZone, deleteZone, toggleZoneConnection,
  addZoneEffect, removeZoneEffect, graftZoneTemplate,
} from "./encounterZones.js";
import { areZonesAdjacent, zoneDistances } from "./zoneGraph.js";

function zone(id: string, connections: string[] = []): EncounterZone {
  return { id, name: id, tags: [], x: 0, y: 0, connections, revealed: true };
}

function combatant(id: string, zoneId?: string): LiveCombatant {
  return { id, name: id, initiative: 10, conditions: [], notes: "", kind: "custom", hpVisible: false, zoneId };
}

function encounter(partial: Partial<EncounterStateInput> = {}): EncounterStateInput {
  return { combatants: [], round: 1, turnIndex: 0, zones: [], zoneEffects: [], ...partial };
}

describe("addZone", () => {
  it("names and lays out each new zone from how many are already there", () => {
    const one = addZone(encounter());
    expect(one.zones).toHaveLength(1);
    expect(one.zones[0].name).toBe("Zone 1");
    expect(one.zones[0].connections).toEqual([]);

    const five = [0, 0, 0, 0].reduce((e) => addZone(e), one);
    expect(five.zones[4].name).toBe("Zone 5");
    // Fifth zone wraps onto a second row rather than off the canvas.
    expect(five.zones[4].y).toBeGreaterThan(five.zones[0].y);
    expect(five.zones[4].x).toBe(five.zones[0].x);
  });

  it("gives every zone its own id", () => {
    const e = [0, 0, 0].reduce((acc) => addZone(acc), encounter());
    expect(new Set(e.zones.map((z) => z.id)).size).toBe(3);
  });
});

describe("deleteZone", () => {
  it("takes every reference to the zone with it", () => {
    const e = encounter({
      zones: [zone("a", ["b"]), zone("b", ["a", "c"]), zone("c", ["b"])],
      zoneEffects: [
        { id: "e1", zoneId: "b", label: "Fog", expiresAtRound: 3 },
        { id: "e2", zoneId: "c", label: "Fire", expiresAtRound: 4 },
      ],
      combatants: [combatant("x", "b"), combatant("y", "c")],
    });

    const after = deleteZone(e, "b");

    expect(after.zones.map((z) => z.id)).toEqual(["a", "c"]);
    // No surviving zone still points at the deleted one.
    expect(after.zones.flatMap((z) => z.connections)).not.toContain("b");
    expect(after.zoneEffects.map((eff) => eff.id)).toEqual(["e2"]);
    // Whoever was standing there is left somewhere valid, not in a zone
    // that no longer exists.
    expect(after.combatants.find((c) => c.id === "x")?.zoneId).toBeUndefined();
    expect(after.combatants.find((c) => c.id === "y")?.zoneId).toBe("c");
  });

  it("leaves an encounter untouched when the zone isn't there", () => {
    const e = encounter({ zones: [zone("a")], combatants: [combatant("x", "a")] });
    const after = deleteZone(e, "nope");
    expect(after.zones).toHaveLength(1);
    expect(after.combatants[0].zoneId).toBe("a");
  });
});

describe("toggleZoneConnection", () => {
  it("writes both ends of a new link", () => {
    const after = toggleZoneConnection(encounter({ zones: [zone("a"), zone("b")] }), "a", "b");
    expect(after.zones.find((z) => z.id === "a")!.connections).toEqual(["b"]);
    expect(after.zones.find((z) => z.id === "b")!.connections).toEqual(["a"]);
  });

  it("unlinks from either direction, whichever way the link was made", () => {
    const linked = toggleZoneConnection(encounter({ zones: [zone("a"), zone("b")] }), "a", "b");
    // Clicking the two zones in the opposite order used to add the missing
    // second side instead of removing the link, leaving them connected.
    const after = toggleZoneConnection(linked, "b", "a");
    expect(areZonesAdjacent(after.zones, "a", "b")).toBe(false);
    expect(after.zones.every((z) => z.connections.length === 0)).toBe(true);
  });

  it("removes a one-sided link saved before both ends were written", () => {
    // An encounter stored by an older version: only "a" knows about "b".
    const legacy = encounter({ zones: [zone("a", ["b"]), zone("b")] });
    expect(areZonesAdjacent(legacy.zones, "a", "b")).toBe(true);

    // Removable in one click from the side that never held the link.
    const after = toggleZoneConnection(legacy, "b", "a");
    expect(areZonesAdjacent(after.zones, "a", "b")).toBe(false);
  });

  it("refuses to link a zone to itself", () => {
    const e = encounter({ zones: [zone("a")] });
    expect(toggleZoneConnection(e, "a", "a")).toBe(e);
  });

  it("leaves other zones' links alone", () => {
    const e = encounter({ zones: [zone("a"), zone("b"), zone("c", ["a"])] });
    const after = toggleZoneConnection(e, "a", "b");
    expect(after.zones.find((z) => z.id === "c")!.connections).toEqual(["a"]);
  });
});

describe("zone effects", () => {
  it("dates an effect from the current round", () => {
    const after = addZoneEffect(encounter({ round: 4 }), "a", "Grease", 3);
    expect(after.zoneEffects).toHaveLength(1);
    expect(after.zoneEffects[0]).toMatchObject({ zoneId: "a", label: "Grease", expiresAtRound: 7 });
  });

  it("removes one effect by id and leaves the rest", () => {
    const e = encounter({
      zoneEffects: [
        { id: "e1", zoneId: "a", label: "Fog", expiresAtRound: 2 },
        { id: "e2", zoneId: "a", label: "Fire", expiresAtRound: 3 },
      ],
    });
    expect(removeZoneEffect(e, "e1").zoneEffects.map((x) => x.id)).toEqual(["e2"]);
  });
});

describe("graftZoneTemplate", () => {
  const template = [zone("t1", ["t2"]), zone("t2", ["t1"])];

  it("adds the template alongside what's already there", () => {
    const after = graftZoneTemplate(encounter({ zones: [zone("existing")] }), template);
    expect(after.zones).toHaveLength(3);
    expect(after.zones[0].id).toBe("existing");
  });

  it("gives the copy fresh ids and rewrites its links to match", () => {
    const after = graftZoneTemplate(encounter(), template);
    const [a, b] = after.zones;
    expect(a.id).not.toBe("t1");
    expect(b.id).not.toBe("t2");
    expect(a.connections).toEqual([b.id]);
    expect(b.connections).toEqual([a.id]);
  });

  it("keeps two copies of one template as two separate rooms", () => {
    // Same template twice is a real case (two identical rooms), and sharing
    // ids would collapse them into one ambiguous graph.
    const once = graftZoneTemplate(encounter(), template);
    const twice = graftZoneTemplate(once, template);
    expect(twice.zones).toHaveLength(4);
    expect(new Set(twice.zones.map((z) => z.id)).size).toBe(4);
    // The two rooms stay unreachable from each other.
    const distances = zoneDistances(twice.zones, twice.zones[0].id);
    expect(distances.get(twice.zones[1].id)).toBe(1);
    expect(distances.has(twice.zones[2].id)).toBe(false);
  });

  it("drops a link pointing outside the template rather than carrying it over", () => {
    const after = graftZoneTemplate(encounter(), [zone("t1", ["gone"])]);
    expect(after.zones[0].connections).toEqual([]);
  });
});
