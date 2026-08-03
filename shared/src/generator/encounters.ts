import { ENCOUNTER_TERRAINS, ENCOUNTER_POOLS } from "../data/encounters.js";
import { pick, sampleUnique } from "./random.js";
import type { GenerateEncounterTableRequest, GeneratedEncounterTable } from "../types.js";

const TABLE_SIZE = 8;

export function generateEncounterTable(request: GenerateEncounterTableRequest = {}): GeneratedEncounterTable {
  const terrain =
    !request.fullyRandom && request.terrain
      ? ENCOUNTER_TERRAINS.find((t) => t.id === request.terrain) ?? pick(ENCOUNTER_TERRAINS)
      : pick(ENCOUNTER_TERRAINS);

  const descriptions = sampleUnique(ENCOUNTER_POOLS[terrain.id], TABLE_SIZE);
  const entries = descriptions.map((description, index) => ({
    roll: String(index + 1),
    description,
  }));

  const generatedName = `${terrain.name} Encounters`;
  const name = !request.fullyRandom && request.name ? request.name : generatedName;

  return { name, terrain: terrain.name, entries };
}
