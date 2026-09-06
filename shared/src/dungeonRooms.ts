import type { DungeonRoomState, DungeonRoomStatePatch, EncounterStateInput, EncounterZone } from "./types.js";

// What a dungeon room remembers between visits, and the two rules that
// maintain it.
//
// The split here is the point. A visiting client can only report what it
// *observed* — this room had no hostiles left, this trap got disarmed, the
// party was here on day 12 — and the server decides how that lands on top
// of whatever the room already remembered. Neither half needs the other's
// state, so nothing has to read-then-write.
//
// It used to work the other way: the client fetched the dungeon, merged in
// its own changes, and PUT the whole rooms array back. Two of those in
// flight at once (fleeing a monster, then leaving the room a moment later)
// meant the second one's fetch could land before the first one's write, and
// the merge it had computed from stale state was what got stored — losing
// the alerted flag that the flee had just set, despite alerted being
// documented as sticky.

export const DEFAULT_ROOM_STATE: DungeonRoomState = {
  cleared: false,
  alerted: false,
  disarmedHazardZoneIds: [],
};

// What leaving this room tells us about it. Pure, and deliberately says
// nothing about what the room already remembered — see mergeRoomState.
//
// `cleared` is recomputed from the live encounter every time rather than
// latched, so a room can also *un*-clear if the DM adds fresh monsters and
// leaves before finishing them off.
//
// Disarmed traps are found by diffing the live zones against the room's
// template: a zone that carries a hazard in the template but doesn't in the
// live encounter had its trap dealt with. That diff matches on zone id, so
// it only works because loading a dungeon room copies the template's zones
// with their ids intact — unlike graftZoneTemplate, which deliberately
// remaps ids so one template can be dropped into an encounter twice. Don't
// route the dungeon loader through that one.
export function observeRoomOnLeave(
  templateZones: EncounterZone[],
  encounter: Pick<EncounterStateInput, "combatants" | "zones">,
  currentDay?: number,
): DungeonRoomStatePatch {
  const liveById = new Map(encounter.zones.map((z) => [z.id, z]));
  const disarmedHazardZoneIds = templateZones
    .filter((tz) => tz.hazard)
    .map((tz) => tz.id)
    .filter((zoneId) => {
      const live = liveById.get(zoneId);
      return !!live && !live.hazard;
    });

  return {
    cleared: !encounter.combatants.some((c) => c.kind === "monster" && (c.currentHp ?? 0) > 0),
    ...(currentDay !== undefined ? { lastVisitedDay: currentDay } : {}),
    ...(disarmedHazardZoneIds.length > 0 ? { disarmedHazardZoneIds } : {}),
  };
}

// How an observation lands on what the room already remembered. The server
// applies this while holding the room's lock, so it is the only place two
// concurrent visitors' reports get combined.
//
// The three fields behave differently on purpose:
//   cleared         replaces — it is recomputed from scratch on every leave.
//   alerted         is OR-ed, never cleared: a warned dungeon doesn't
//                   forget. Resetting it is an authoring action and goes
//                   through the ordinary dungeon edit route instead.
//   disarmed traps  accumulate — a trap dealt with on an earlier visit
//                   stays dealt with.
export function mergeRoomState(prev: DungeonRoomState | undefined, patch: DungeonRoomStatePatch): DungeonRoomState {
  const base = prev ?? DEFAULT_ROOM_STATE;
  return {
    cleared: patch.cleared ?? base.cleared,
    alerted: base.alerted || patch.alerted === true,
    lastVisitedDay: patch.lastVisitedDay ?? base.lastVisitedDay,
    disarmedHazardZoneIds: patch.disarmedHazardZoneIds
      ? [...new Set([...base.disarmedHazardZoneIds, ...patch.disarmedHazardZoneIds])]
      : base.disarmedHazardZoneIds,
  };
}

// The zones a room opens with: its template, with every trap this room
// remembers being disarmed stripped back out again.
export function applyRoomStateToZones(templateZones: EncounterZone[], state: DungeonRoomState | undefined): EncounterZone[] {
  const disarmed = new Set(state?.disarmedHazardZoneIds ?? []);
  return templateZones.map((z) => (disarmed.has(z.id) && z.hazard ? { ...z, hazard: undefined } : z));
}
