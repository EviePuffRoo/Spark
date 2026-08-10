import {
  TERRAIN_CATEGORIES, DANGER_LEVELS, REGION_NAME_ADJECTIVES, REGION_NAME_NOUNS, REGION_DESCRIPTIONS, REGION_FEATURES,
} from "../data/regions.js";
import { pick } from "./random.js";
import type { GenerateRegionRequest, GeneratedRegion } from "../types.js";

export function generateRegion(request: GenerateRegionRequest = {}): GeneratedRegion {
  const terrain =
    !request.fullyRandom && request.terrainCategory
      ? TERRAIN_CATEGORIES.find((t) => t.id === request.terrainCategory) ?? pick(TERRAIN_CATEGORIES)
      : pick(TERRAIN_CATEGORIES);

  const name = `The ${pick(REGION_NAME_ADJECTIVES)} ${pick(REGION_NAME_NOUNS)}`;
  const description = pick(REGION_DESCRIPTIONS).replace("{feature}", pick(REGION_FEATURES));

  return {
    name,
    terrainCategory: terrain.name,
    dangerLevel: pick(DANGER_LEVELS),
    description,
  };
}
