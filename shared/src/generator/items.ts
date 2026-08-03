import { ITEM_CATEGORIES, ITEM_TYPES_BY_CATEGORY, ITEM_ADJECTIVES, ITEM_PROPERTIES, ITEM_HISTORIES, ITEM_RARITY_TIERS, ITEM_EPITHETS } from "../data/items.js";
import { pick, titleCase, article } from "./random.js";
import type { GenerateItemRequest, GeneratedItem } from "../types.js";

export function generateItem(request: GenerateItemRequest = {}): GeneratedItem {
  const category =
    !request.fullyRandom && request.category
      ? ITEM_CATEGORIES.find((c) => c.id === request.category) ?? pick(ITEM_CATEGORIES)
      : pick(ITEM_CATEGORIES);

  const itemType = pick(ITEM_TYPES_BY_CATEGORY[category.id]);
  const adjective = pick(ITEM_ADJECTIVES);

  const rarity =
    !request.fullyRandom && request.rarity ? request.rarity : pick(ITEM_RARITY_TIERS);

  const baseName = `${titleCase(adjective)} ${itemType}`;
  const generatedName = Math.random() < 0.4 ? `${baseName}, called ${pick(ITEM_EPITHETS)}` : baseName;
  const name = !request.fullyRandom && request.name ? request.name : generatedName;

  return {
    name,
    itemType,
    category: category.name,
    rarity,
    description: `${article(adjective)} ${adjective} ${itemType.toLowerCase()}.`,
    property: pick(ITEM_PROPERTIES),
    history: pick(ITEM_HISTORIES),
  };
}
