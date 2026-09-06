import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dungeon, EncounterStateInput } from "@spark/shared";
import { applyRoomStateToZones, observeRoomOnLeave } from "@spark/shared";
import { api } from "./api";
import type { ActiveEncounter } from "./useEncounterState";
import type { GridExit } from "./components/GridMapExits";

// Running the party through a dungeon: which room they're in, what that
// room remembers, and the exits off it.
//
// The rules themselves are pure and live in shared/src/dungeonRooms.ts —
// what a leave observes, how it merges, what a load strips back out. What's
// here is the I/O around them, which is the part that couldn't move: three
// endpoints, an encounter write, and a fetched Dungeon held in component
// state so the banner and the grid's exits have something to read.
//
// The important shape change is that leaving a room no longer reads the
// dungeon in order to write it. A visit reports only what it saw and the
// server merges that under a lock, so a monster fleeing and the party
// leaving a moment later can't overwrite each other — which they could,
// and the casualty was the sticky "alerted" flag.

export function useDungeonRoom({
  activeEncounter, applyEncounterUpdate, canEdit, currentDay,
}: {
  activeEncounter: ActiveEncounter;
  applyEncounterUpdate: (updater: (e: EncounterStateInput) => EncounterStateInput) => void;
  canEdit: boolean;
  // The world's calendar day, stamped onto a room as the party leaves it.
  currentDay?: number;
}) {
  const [activeDungeon, setActiveDungeon] = useState<Dungeon | null>(null);

  const dungeonId = activeEncounter.activeDungeonId;
  const roomId = activeEncounter.activeDungeonRoomId;

  // Read through a ref by the async handlers below, so they always see the
  // encounter as it is when they run rather than as it was when the click
  // handler was created. Leaving a room reads the live combatants and zones
  // to work out what it observed, and those change constantly.
  const encounterRef = useRef(activeEncounter);
  encounterRef.current = activeEncounter;
  const dungeonRef = useRef<Dungeon | null>(activeDungeon);
  dungeonRef.current = activeDungeon;
  const currentDayRef = useRef(currentDay);
  currentDayRef.current = currentDay;

  // Which dungeon we last fetched for, so entering a room we just loaded
  // ourselves doesn't send us straight back to the server for it.
  const fetchedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!canEdit || !dungeonId) {
      setActiveDungeon(null);
      fetchedForRef.current = null;
      return;
    }
    if (fetchedForRef.current === dungeonId) return;
    let cancelled = false;
    api.getDungeon(dungeonId)
      .then((d) => {
        if (cancelled) return;
        fetchedForRef.current = dungeonId;
        setActiveDungeon(d);
      })
      .catch(() => { if (!cancelled) setActiveDungeon(null); });
    return () => { cancelled = true; };
  }, [canEdit, dungeonId]);

  // Reports what this visit saw about the room being left, so the room
  // remembers it. Never reads the dungeon first — see the module comment.
  const reportRoomOnLeave = useCallback(async () => {
    const dungeon = dungeonRef.current;
    const encounter = encounterRef.current;
    const leavingDungeonId = encounter.activeDungeonId;
    const leavingRoomId = encounter.activeDungeonRoomId;
    if (!leavingDungeonId || !leavingRoomId || !dungeon) return;
    const room = dungeon.rooms.find((r) => r.id === leavingRoomId);
    if (!room) return;

    // A template that won't load costs us the disarmed-trap diff for this
    // visit, but cleared/lastVisitedDay are still worth recording.
    const template = await api.getZoneMapTemplate(room.templateId).catch(() => null);
    const patch = observeRoomOnLeave(template?.zones ?? [], encounter, currentDayRef.current);
    const updated = await api.patchDungeonRoomState(leavingDungeonId, leavingRoomId, patch).catch(() => null);
    if (updated && dungeonRef.current?.id === updated.id) setActiveDungeon(updated);
  }, []);

  const loadRoom = useCallback(async (nextDungeonId: string, nextRoomId: string) => {
    await reportRoomOnLeave();
    const dungeon = await api.getDungeon(nextDungeonId);
    const room = dungeon.rooms.find((r) => r.id === nextRoomId);
    if (!room) return;
    const template = await api.getZoneMapTemplate(room.templateId);
    applyEncounterUpdate((e) => ({
      ...e,
      // A trap this room remembers being disarmed stays disarmed on reload.
      zones: applyRoomStateToZones(template.zones, room.state),
      zoneEffects: [],
      activeDungeonId: nextDungeonId,
      activeDungeonRoomId: nextRoomId,
      // Coexists with the zone load above rather than replacing it — a
      // room's assigned battle map (set in DungeonEditor) auto-loads the
      // same way its zone template does, the moment the party enters.
      activeBattleMapId: room.battleMapId,
    }));
    fetchedForRef.current = nextDungeonId;
    setActiveDungeon(dungeon);
  }, [applyEncounterUpdate, reportRoomOnLeave]);

  const leaveDungeon = useCallback(async () => {
    await reportRoomOnLeave();
    applyEncounterUpdate((e) => ({ ...e, activeDungeonId: undefined, activeDungeonRoomId: undefined }));
    fetchedForRef.current = null;
    setActiveDungeon(null);
  }, [applyEncounterUpdate, reportRoomOnLeave]);

  // A fled monster is still out there and may have warned the rest of the
  // dungeon, so the room stays alerted. One additive write, no read.
  const markRoomAlerted = useCallback(async () => {
    const encounter = encounterRef.current;
    if (!encounter.activeDungeonId || !encounter.activeDungeonRoomId) return;
    const updated = await api
      .patchDungeonRoomState(encounter.activeDungeonId, encounter.activeDungeonRoomId, { alerted: true })
      .catch(() => null);
    if (updated && dungeonRef.current?.id === updated.id) setActiveDungeon(updated);
  }, []);

  const activeRoom = useMemo(
    () => (activeDungeon && roomId ? activeDungeon.rooms.find((r) => r.id === roomId) ?? null : null),
    [activeDungeon, roomId],
  );

  // Exits off the room the party is standing in that the DM has put on an
  // edge of its battle map. Empty outside a dungeon, or before any exit has
  // been given an edge — the zone view's Move Party button is unaffected
  // either way.
  const gridExits = useMemo<GridExit[]>(() => {
    if (!activeDungeon || !activeRoom) return [];
    return activeRoom.exits
      .filter((e) => !!e.mapEdge)
      .map((e) => ({
        toRoomId: e.toRoomId,
        toRoomName: activeDungeon.rooms.find((r) => r.id === e.toRoomId)?.name ?? "another room",
        label: e.label,
        mapEdge: e.mapEdge!,
      }));
  }, [activeDungeon, activeRoom]);

  return { activeDungeon, activeRoom, gridExits, loadRoom, leaveDungeon, markRoomAlerted };
}
