import { useCallback, useEffect, useRef, useState } from "react";
import type { Encounter, EncounterStateInput } from "@spark/shared";
import { api } from "./api";
import { useLocalStorage } from "./useLocalStorage";
import { useWorldLiveChannel } from "./useWorldLiveChannel";

// The encounter the tracker is running, and the two very different places
// it can live.
//
// In personal mode it's a value in this browser's localStorage and a write
// is just a setState. In party mode it's the world's shared encounter: the
// DM's writes go out as full PUTs and everyone else's arrive pushed over
// the live channel, non-owners write through narrow per-action endpoints
// instead, and both paths have ordering hazards that have already bitten.
//
// Pulling it out of InitiativeTracker isn't only about the component's
// size. Every feature added to the tracker has to get this duality right,
// and it was previously something you re-derived from the shape of
// applyEncounterUpdate each time — the stale-world guard in particular was
// copied at three call sites, where forgetting it silently stomps one
// world's live state with another's. Here it's one function to call.

export const BLANK_ENCOUNTER: EncounterStateInput = { combatants: [], round: 1, turnIndex: 0, zones: [], zoneEffects: [] };

// The live encounter is widened only to surface visibleCells (server-
// computed, response-only — see Encounter in shared/src/types.ts) for the
// fog-of-war rendering GridMap does; every other field comes straight from
// EncounterStateInput, which the runtime value (an Encounter, structurally
// a superset) always satisfies.
export type ActiveEncounter = EncounterStateInput & { visibleCells?: string[] };

export function useEncounterState({ partyMode, partyWorldId, isOwner }: {
  partyMode: boolean;
  partyWorldId: string;
  isOwner: boolean;
}) {
  const [encounter, setEncounter] = useLocalStorage<EncounterStateInput>("spark-combat-encounter", BLANK_ENCOUNTER);
  const [liveEncounter, setLiveEncounter] = useState<EncounterStateInput | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Full-encounter saves are fire-and-forget PUTs with no server-side
  // ordering guarantee; two saves issued close together (e.g. a quick
  // "Next Turn" followed by an HP change) could otherwise arrive out of
  // order and let the older one silently overwrite the newer one. Chaining
  // them through this ref forces each save to wait for the previous one to
  // settle before going out, so they always land at the server in the same
  // order they were issued.
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  // A non-owner's writes go through narrow endpoints that return the new
  // encounter — but if the viewer switches worlds (or flips back to
  // Personal mode) before that response lands, applying it unconditionally
  // would stomp the newly-selected world's live state with the old world's
  // data. Read fresh on every render (not just in an effect) so a .then()
  // callback always sees the current values, not the ones closed over when
  // the request fired.
  const liveContextRef = useRef({ partyWorldId, partyMode });
  liveContextRef.current = { partyWorldId, partyMode };

  useEffect(() => {
    if (!partyMode || !partyWorldId) setLiveEncounter(null);
  }, [partyMode, partyWorldId]);

  const { error: liveConnError } = useWorldLiveChannel(partyMode ? partyWorldId : null, {
    onEncounter: setLiveEncounter,
    onTokenMoved: (payload) => {
      setLiveEncounter((e) => e && ({
        ...e,
        combatants: e.combatants.map((c) => (c.id === payload.combatantId ? { ...c, gridX: payload.gridX, gridY: payload.gridY } : c)),
      }));
    },
  });
  useEffect(() => { setLiveError(liveConnError ?? null); }, [liveConnError]);

  const activeEncounter: ActiveEncounter = partyMode ? (liveEncounter ?? BLANK_ENCOUNTER) : encounter;

  // The DM's write path, and the only one that can rewrite the whole
  // encounter: apply the change locally straight away so the table sees it
  // now, and queue the save behind whatever is already in flight.
  const applyEncounterUpdate = useCallback((updater: (e: EncounterStateInput) => EncounterStateInput) => {
    if (partyMode && isOwner && partyWorldId) {
      setLiveEncounter((e) => {
        const next = updater(e ?? BLANK_ENCOUNTER);
        saveQueueRef.current = saveQueueRef.current.then(
          () => api.saveEncounter(partyWorldId, next),
          () => api.saveEncounter(partyWorldId, next),
        ).catch((err) => setLiveError((err as Error).message));
        return next;
      });
    } else {
      setEncounter(updater);
    }
  }, [partyMode, isOwner, partyWorldId, setEncounter]);

  // A non-owner's write path: one of the narrow party endpoints, whose
  // response is the authoritative encounter (already redacted for this
  // viewer). Guarded so a response that outlives the world it was asked
  // about is dropped rather than applied — this check was copied at every
  // call site before, which is exactly one place too many for something
  // whose failure mode is silent.
  //
  // requestWorldId is passed rather than read off the ref: it has to be the
  // world the caller actually addressed the request to, which is the one in
  // its own closure, not whichever world is selected by the time this runs.
  const applyServerEncounter = useCallback((requestWorldId: string, request: Promise<Encounter>) => {
    request
      .then((result) => {
        if (liveContextRef.current.partyWorldId === requestWorldId && liveContextRef.current.partyMode) setLiveEncounter(result);
      })
      .catch((err) => setLiveError((err as Error).message));
  }, []);

  return { activeEncounter, applyEncounterUpdate, applyServerEncounter, liveError };
}
