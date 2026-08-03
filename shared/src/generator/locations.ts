import {
  LOCATION_CATEGORIES, LOCATION_TYPES_BY_CATEGORY, LOCATION_DESCRIPTORS,
  LOCATION_NAME_ADJECTIVES, LOCATION_NAME_NOUNS, LOCATION_FEATURES, LOCATION_KEEPERS, LOCATION_RUMORS,
} from "../data/locations.js";
import { pick, titleCase, article } from "./random.js";
import type { GenerateLocationRequest, GeneratedLocation } from "../types.js";

export function generateLocation(request: GenerateLocationRequest = {}): GeneratedLocation {
  const category =
    !request.fullyRandom && request.category
      ? LOCATION_CATEGORIES.find((c) => c.id === request.category) ?? pick(LOCATION_CATEGORIES)
      : pick(LOCATION_CATEGORIES);

  const locationType = pick(LOCATION_TYPES_BY_CATEGORY[category.id]);
  const descriptor = pick(LOCATION_DESCRIPTORS);

  const generatedName =
    Math.random() < 0.5
      ? `The ${pick(LOCATION_NAME_ADJECTIVES)} ${pick(LOCATION_NAME_NOUNS)}`
      : `${titleCase(descriptor)} ${locationType}`;
  const name = !request.fullyRandom && request.name ? request.name : generatedName;

  return {
    name,
    locationType,
    category: category.name,
    description: `${article(descriptor)} ${descriptor} ${locationType.toLowerCase()}.`,
    notableFeature: pick(LOCATION_FEATURES),
    keeper: pick(LOCATION_KEEPERS),
    rumor: pick(LOCATION_RUMORS),
  };
}
