import type { Encounter } from "@spark/shared";

// Mirrors the non-owner branch of toEncounterDTO (server/src/serialize.ts)
// client-side, for the DM's own "cast to a second screen" display — a
// convenience filter, not a security boundary, since it only ever runs on
// data the DM's own browser already has full access to.
export function filterEncounterForDisplay(encounter: Encounter): Encounter {
  const visibleZones = encounter.zones.filter((z) => z.revealed);
  const visibleZoneIds = new Set(visibleZones.map((z) => z.id));
  const zones = visibleZones.map((z) => ({
    ...z,
    connections: z.connections.filter((id) => visibleZoneIds.has(id)),
  }));

  const zoneEffects = encounter.zoneEffects.filter(
    (e) => e.expiresAtRound >= encounter.round && visibleZoneIds.has(e.zoneId),
  );

  const combatants = encounter.combatants
    .map((c) => ({
      ...c,
      currentHp: c.hpVisible ? c.currentHp : undefined,
      maxHp: c.hpVisible ? c.maxHp : undefined,
      xp: undefined,
      attacks: undefined,
      conditions: c.conditions.filter((cond) => cond.expiresAtRound === null || cond.expiresAtRound >= encounter.round),
    }))
    .filter((c) => {
      if (c.hidden) return false;
      if (c.zoneId && !visibleZoneIds.has(c.zoneId)) return false;
      return true;
    });

  return { ...encounter, zones, zoneEffects, combatants };
}
