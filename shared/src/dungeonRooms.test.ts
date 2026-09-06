import { describe, it, expect } from "vitest";
import type { DungeonRoomState, EncounterZone, LiveCombatant } from "./types.js";
import { DEFAULT_ROOM_STATE, applyRoomStateToZones, mergeRoomState, observeRoomOnLeave } from "./dungeonRooms.js";

function zone(id: string, hazard?: { label: string; damage: number }): EncounterZone {
  return { id, name: id, tags: [], x: 0, y: 0, connections: [], revealed: true, ...(hazard ? { hazard } : {}) };
}

function monster(id: string, currentHp: number): LiveCombatant {
  return { id, name: id, initiative: 10, conditions: [], notes: "", kind: "monster", hpVisible: false, currentHp, maxHp: 10 };
}

function pc(id: string, currentHp: number): LiveCombatant {
  return { id, name: id, initiative: 10, conditions: [], notes: "", kind: "playerCharacter", hpVisible: true, currentHp, maxHp: 10 };
}

const TRAP = { label: "Dart Trap", damage: 5 };

describe("observeRoomOnLeave", () => {
  it("reports cleared when no hostile is left standing", () => {
    const patch = observeRoomOnLeave([], { combatants: [monster("m1", 0), pc("p1", 8)], zones: [] });
    expect(patch.cleared).toBe(true);
  });

  it("reports not cleared while a monster is still up", () => {
    const patch = observeRoomOnLeave([], { combatants: [monster("m1", 3), pc("p1", 8)], zones: [] });
    expect(patch.cleared).toBe(false);
  });

  it("recomputes cleared rather than latching it, so a room can un-clear", () => {
    // A DM who drops fresh monsters into a cleared room and leaves again
    // should not have it still remembered as cleared.
    const patch = observeRoomOnLeave([], { combatants: [monster("new", 10)], zones: [] });
    expect(patch.cleared).toBe(false);
  });

  it("reports a trap disarmed when the live zone lost the template's hazard", () => {
    const template = [zone("z1", TRAP), zone("z2")];
    const patch = observeRoomOnLeave(template, { combatants: [], zones: [zone("z1"), zone("z2")] });
    expect(patch.disarmedHazardZoneIds).toEqual(["z1"]);
  });

  it("reports nothing disarmed while the hazard is still live", () => {
    const template = [zone("z1", TRAP)];
    const patch = observeRoomOnLeave(template, { combatants: [], zones: [zone("z1", TRAP)] });
    expect(patch.disarmedHazardZoneIds).toBeUndefined();
  });

  it("ignores a template hazard whose zone isn't in the live encounter at all", () => {
    // Absent is not the same as disarmed — the zone may simply have been
    // deleted, and claiming its trap was dealt with would be a lie the room
    // then remembers forever.
    const template = [zone("z1", TRAP)];
    const patch = observeRoomOnLeave(template, { combatants: [], zones: [] });
    expect(patch.disarmedHazardZoneIds).toBeUndefined();
  });

  it("stamps the day only when one is known", () => {
    expect(observeRoomOnLeave([], { combatants: [], zones: [] }, 12).lastVisitedDay).toBe(12);
    expect(observeRoomOnLeave([], { combatants: [], zones: [] })).not.toHaveProperty("lastVisitedDay");
  });
});

describe("mergeRoomState", () => {
  const prior: DungeonRoomState = { cleared: true, alerted: true, lastVisitedDay: 5, disarmedHazardZoneIds: ["z1"] };

  it("starts from the default when the room has no state yet", () => {
    expect(mergeRoomState(undefined, {})).toEqual(DEFAULT_ROOM_STATE);
  });

  it("lets cleared go back to false", () => {
    expect(mergeRoomState(prior, { cleared: false }).cleared).toBe(false);
  });

  it("never clears alerted — a warned dungeon doesn't forget", () => {
    // This is the invariant the old client-side read-modify-write lost: a
    // leave report computed from state fetched before a flee landed would
    // write alerted:false straight back over it.
    expect(mergeRoomState(prior, { alerted: false }).alerted).toBe(true);
    expect(mergeRoomState(prior, {}).alerted).toBe(true);
    expect(mergeRoomState(DEFAULT_ROOM_STATE, { alerted: true }).alerted).toBe(true);
    expect(mergeRoomState(DEFAULT_ROOM_STATE, {}).alerted).toBe(false);
  });

  it("accumulates disarmed traps instead of replacing them", () => {
    const merged = mergeRoomState(prior, { disarmedHazardZoneIds: ["z2"] });
    expect(merged.disarmedHazardZoneIds.sort()).toEqual(["z1", "z2"]);
  });

  it("does not re-add a trap it already knows about", () => {
    expect(mergeRoomState(prior, { disarmedHazardZoneIds: ["z1"] }).disarmedHazardZoneIds).toEqual(["z1"]);
  });

  it("keeps what it already remembered when the patch omits a field", () => {
    expect(mergeRoomState(prior, {})).toEqual(prior);
  });

  it("survives two reports in either order", () => {
    // The race this whole split exists to remove: a flee and a leave landing
    // close together must end up the same however they interleave.
    const flee = { alerted: true } as const;
    const leave = { cleared: true, disarmedHazardZoneIds: ["z9"] };
    const fleeFirst = mergeRoomState(mergeRoomState(DEFAULT_ROOM_STATE, flee), leave);
    const leaveFirst = mergeRoomState(mergeRoomState(DEFAULT_ROOM_STATE, leave), flee);
    expect(fleeFirst).toEqual(leaveFirst);
    expect(fleeFirst).toEqual({ cleared: true, alerted: true, lastVisitedDay: undefined, disarmedHazardZoneIds: ["z9"] });
  });
});

describe("applyRoomStateToZones", () => {
  const template = [zone("z1", TRAP), zone("z2", TRAP), zone("z3")];

  it("strips the hazard from a zone the room remembers being disarmed", () => {
    const zones = applyRoomStateToZones(template, { ...DEFAULT_ROOM_STATE, disarmedHazardZoneIds: ["z1"] });
    expect(zones.find((z) => z.id === "z1")?.hazard).toBeUndefined();
    expect(zones.find((z) => z.id === "z2")?.hazard).toEqual(TRAP);
  });

  it("returns the template untouched for a room with no memory", () => {
    expect(applyRoomStateToZones(template, undefined)).toEqual(template);
  });

  it("round-trips: what a leave observes is what the next load strips", () => {
    const live = [zone("z1"), zone("z2", TRAP), zone("z3")];
    const patch = observeRoomOnLeave(template, { combatants: [], zones: live });
    const stored = mergeRoomState(undefined, patch);
    const reloaded = applyRoomStateToZones(template, stored);
    expect(reloaded.find((z) => z.id === "z1")?.hazard).toBeUndefined();
    expect(reloaded.find((z) => z.id === "z2")?.hazard).toEqual(TRAP);
  });
});
