import type { EncounterStateInput, EncounterZone } from "./types.js";
import { areZonesAdjacent } from "./zoneGraph.js";

// Editing an encounter's zone map: add, rename, link, delete, and the
// timed effects that sit on a zone.
//
// Every one of these is a pure (encounter, args) -> encounter transition,
// which is why they live here rather than in the tracker component that
// used to hold them. Two of them earn it beyond tidiness:
//
// deleteZone has to keep the graph consistent — a deleted zone must also
// vanish from every other zone's connections, take its effects with it,
// and leave the combatants who were standing in it somewhere valid. Miss
// one of those and the map keeps a link to a zone that no longer exists.
//
// graftZoneTemplate has to rewrite ids as it copies, because a template's
// zones can be dropped into an encounter more than once and two zones
// sharing an id would make the whole graph ambiguous.
//
// Being pure also means they're cheap to test exhaustively, which the
// cascade above very much wants.

const ZONE_COLUMNS = 4;
const ZONE_SPACING = 140;
const ZONE_ORIGIN = 100;

export function addZone(e: EncounterStateInput): EncounterStateInput {
  const zones = e.zones ?? [];
  const zone: EncounterZone = {
    id: crypto.randomUUID(),
    name: `Zone ${zones.length + 1}`,
    tags: [],
    x: ZONE_ORIGIN + (zones.length % ZONE_COLUMNS) * ZONE_SPACING,
    y: ZONE_ORIGIN + Math.floor(zones.length / ZONE_COLUMNS) * ZONE_SPACING,
    connections: [],
    revealed: true,
  };
  return { ...e, zones: [...zones, zone] };
}

export function updateZone(e: EncounterStateInput, id: string, patch: Partial<EncounterZone>): EncounterStateInput {
  return { ...e, zones: (e.zones ?? []).map((z) => (z.id === id ? { ...z, ...patch } : z)) };
}

// Deleting a zone takes with it every reference to it: the links other
// zones hold to it, the effects that were sitting on it, and the zoneId of
// anyone standing there.
export function deleteZone(e: EncounterStateInput, id: string): EncounterStateInput {
  return {
    ...e,
    zones: (e.zones ?? [])
      .filter((z) => z.id !== id)
      .map((z) => ({ ...z, connections: z.connections.filter((c) => c !== id) })),
    zoneEffects: (e.zoneEffects ?? []).filter((eff) => eff.zoneId !== id),
    combatants: e.combatants.map((c) => (c.zoneId === id ? { ...c, zoneId: undefined } : c)),
  };
}

// Link or unlink two zones, writing BOTH ends.
//
// This used to write only the clicked-from zone's side, on the reasoning
// that every reader treats a link as symmetric anyway (see zoneGraph.ts).
// Readers do — but the zone map draws each edge exactly once, from the end
// with the lexicographically smaller id, so a one-sided link stored on the
// larger id drew no line at all while still being walkable. And unlinking
// only worked if the DM happened to click the two zones in the same order
// they had connected them; the other order silently added the missing
// second side instead, leaving the zones connected.
//
// Storing both ends makes the written form match what every reader already
// assumed. "Connected" is still tested with the tolerant either-side rule,
// so a one-sided link saved by an older version is removable in one click
// from either zone rather than being stuck.
export function toggleZoneConnection(e: EncounterStateInput, aId: string, bId: string): EncounterStateInput {
  if (aId === bId) return e;
  const zones = e.zones ?? [];
  const linked = areZonesAdjacent(zones, aId, bId);
  const link = (z: EncounterZone, otherId: string): EncounterZone => {
    if (linked) return { ...z, connections: z.connections.filter((c) => c !== otherId) };
    return z.connections.includes(otherId) ? z : { ...z, connections: [...z.connections, otherId] };
  };
  return {
    ...e,
    zones: zones.map((z) => {
      if (z.id === aId) return link(z, bId);
      if (z.id === bId) return link(z, aId);
      return z;
    }),
  };
}

export function addZoneEffect(e: EncounterStateInput, zoneId: string, label: string, durationRounds: number): EncounterStateInput {
  return {
    ...e,
    zoneEffects: [
      ...(e.zoneEffects ?? []),
      { id: crypto.randomUUID(), zoneId, label, expiresAtRound: e.round + durationRounds },
    ],
  };
}

export function removeZoneEffect(e: EncounterStateInput, id: string): EncounterStateInput {
  return { ...e, zoneEffects: (e.zoneEffects ?? []).filter((eff) => eff.id !== id) };
}

// Copies a saved zone-map template into the encounter alongside whatever
// is already there. Every zone gets a fresh id and its links are rewritten
// to match, so the same template can be loaded twice — two identical rooms
// in one encounter — without the two copies sharing ids and collapsing
// into one ambiguous graph. A link to a zone not in the template is
// dropped rather than carried over pointing at nothing.
export function graftZoneTemplate(e: EncounterStateInput, templateZones: EncounterZone[]): EncounterStateInput {
  const idMap = new Map<string, string>(templateZones.map((z) => [z.id, crypto.randomUUID()]));
  const remapped: EncounterZone[] = templateZones.map((z) => ({
    ...z,
    id: idMap.get(z.id)!,
    connections: z.connections.map((c) => idMap.get(c)).filter((c): c is string => !!c),
  }));
  return { ...e, zones: [...(e.zones ?? []), ...remapped] };
}
