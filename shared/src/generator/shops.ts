import { SHOP_ARCHETYPES } from "../data/shops.js";
import { LOCATION_NAME_ADJECTIVES, LOCATION_NAME_NOUNS } from "../data/locations.js";
import { pick } from "./random.js";
import { generateItem } from "./items.js";
import type { GenerateShopRequest, GeneratedShop, ShopStockEntry } from "../types.js";

const DEFAULT_STOCK_SIZE = 8;
const MAX_STOCK_SIZE = 20;

export function generateShop(request: GenerateShopRequest = {}): GeneratedShop {
  const archetype =
    !request.fullyRandom && request.archetype
      ? SHOP_ARCHETYPES.find((a) => a.id === request.archetype) ?? pick(SHOP_ARCHETYPES)
      : pick(SHOP_ARCHETYPES);

  const stockSize = request.stockSize && request.stockSize > 0 ? Math.min(MAX_STOCK_SIZE, Math.trunc(request.stockSize)) : DEFAULT_STOCK_SIZE;

  const name = `The ${pick(LOCATION_NAME_ADJECTIVES)} ${pick(LOCATION_NAME_NOUNS)}`;

  const stock: ShopStockEntry[] = Array.from({ length: stockSize }, () => {
    const category = pick(archetype.itemCategories);
    const item = generateItem({ category });
    return {
      id: crypto.randomUUID(),
      itemId: crypto.randomUUID(),
      itemName: item.name,
      price: item.value || 1,
      quantity: -1,
    };
  });

  return { name, description: archetype.description, stock };
}
