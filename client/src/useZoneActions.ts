import { useMemo } from "react";
import type { Encounter, EncounterStateInput, EncounterZone } from "@spark/shared";
import {
  addZone as addZoneRule,
  updateZone as updateZoneRule,
  deleteZone as deleteZoneRule,
  toggleZoneConnection as toggleZoneConnectionRule,
  addZoneEffect as addZoneEffectRule,
  removeZoneEffect as removeZoneEffectRule,
  graftZoneTemplate as graftZoneTemplateRule,
} from "@spark/shared";
import { api } from "./api";

// Binds the zone-map rules in shared/src/encounterZones.ts to whichever
// write path this encounter actually uses (see useEncounterState).
//
// The eight zone functions were the last cluster in InitiativeTracker that
// touched only one part of the encounter, and none of them needed anything
// from the component: seven are pure state transitions, now living in
// shared where they can be tested against the graph they maintain. What is
// left here is the binding, plus the one zone action that isn't a pure
// transition — moving a combatant, which a non-owner performs through a
// narrow server endpoint that enforces adjacency itself.

export interface ZoneActions {
  addZone: () => void;
  updateZone: (id: string, patch: Partial<EncounterZone>) => void;
  deleteZone: (id: string) => void;
  toggleConnection: (aId: string, bId: string) => void;
  addEffect: (zoneId: string, label: string, durationRounds: number) => void;
  removeEffect: (id: string) => void;
  loadTemplate: (templateZones: EncounterZone[]) => void;
  moveCombatant: (combatantId: string, zoneId: string) => void;
}

export function useZoneActions({
  applyEncounterUpdate, applyServerEncounter, canEdit, partyMode, partyWorldId,
}: {
  applyEncounterUpdate: (updater: (e: EncounterStateInput) => EncounterStateInput) => void;
  applyServerEncounter: (requestWorldId: string, request: Promise<Encounter>) => void;
  canEdit: boolean;
  partyMode: boolean;
  partyWorldId: string;
}): ZoneActions {
  return useMemo(() => ({
    addZone: () => applyEncounterUpdate(addZoneRule),
    updateZone: (id, patch) => applyEncounterUpdate((e) => updateZoneRule(e, id, patch)),
    deleteZone: (id) => applyEncounterUpdate((e) => deleteZoneRule(e, id)),
    toggleConnection: (aId, bId) => applyEncounterUpdate((e) => toggleZoneConnectionRule(e, aId, bId)),
    addEffect: (zoneId, label, durationRounds) => applyEncounterUpdate((e) => addZoneEffectRule(e, zoneId, label, durationRounds)),
    removeEffect: (id) => applyEncounterUpdate((e) => removeZoneEffectRule(e, id)),
    loadTemplate: (templateZones) => applyEncounterUpdate((e) => graftZoneTemplateRule(e, templateZones)),
    // The DM moves a token by editing the encounter directly; anyone else
    // asks the server, which re-checks adjacency and visibility against
    // the stored encounter rather than trusting the caller.
    moveCombatant: (combatantId, zoneId) => {
      if (canEdit) {
        applyEncounterUpdate((e) => ({
          ...e,
          combatants: e.combatants.map((c) => (c.id === combatantId ? { ...c, zoneId } : c)),
        }));
      } else if (partyMode && partyWorldId) {
        applyServerEncounter(partyWorldId, api.moveCombatantZone(partyWorldId, combatantId, zoneId));
      }
    },
  }), [applyEncounterUpdate, applyServerEncounter, canEdit, partyMode, partyWorldId]);
}
