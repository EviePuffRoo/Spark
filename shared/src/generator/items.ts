import {
  ITEM_CATEGORIES, ITEM_TYPES_BY_CATEGORY, ITEM_ADJECTIVES, ITEM_PROPERTIES, ITEM_HISTORIES,
  ITEM_RARITY_TIERS, ITEM_RARITY_TIER_INFO, ITEM_RECHARGE_RULES, ITEM_EPITHETS,
} from "../data/items.js";
import { pick, titleCase, article } from "./random.js";
import type { GenerateItemRequest, GeneratedItem, ItemBonusType } from "../types.js";

const OTHER_BONUS_TYPES: ItemBonusType[] = ["savingThrows", "abilityChecks", "spellSaveDc", "none"];

function pickBonusType(categoryId: string, tier: number): ItemBonusType {
  if (tier === 0) return "none";
  if (categoryId === "weapon") return "attackAndDamage";
  if (categoryId === "armor") return "armorClass";
  return pick(OTHER_BONUS_TYPES);
}

function computeBonusValue(tier: number, bonusType: ItemBonusType): number {
  if (bonusType === "none") return 0;
  const variance = Math.random() < 0.25 ? 1 : 0;
  return Math.max(1, ITEM_RARITY_TIER_INFO[tier].typicalBonus + variance);
}

function computeAttunement(tier: number): boolean {
  return Math.random() < (ITEM_RARITY_TIER_INFO[tier].attunementLikely ? 0.75 : 0.1);
}

function computeValue(tier: number): number {
  const [min, max] = ITEM_RARITY_TIER_INFO[tier].valueRange;
  return Math.floor(min + Math.random() * (max - min + 1));
}

function computeCharges(categoryId: string, tier: number): { charges: number | null; rechargeRule: string | null } {
  const eligible = categoryId === "potion" || (categoryId === "wondrous" && tier >= 1);
  if (!eligible || Math.random() < 0.5) return { charges: null, rechargeRule: null };
  if (categoryId === "potion") return { charges: 1, rechargeRule: null };
  return { charges: Math.max(1, Math.round(2 + tier * 1.5)), rechargeRule: pick(ITEM_RECHARGE_RULES) };
}

export function generateItem(request: GenerateItemRequest = {}): GeneratedItem {
  const category =
    !request.fullyRandom && request.category
      ? ITEM_CATEGORIES.find((c) => c.id === request.category) ?? pick(ITEM_CATEGORIES)
      : pick(ITEM_CATEGORIES);

  const itemType = pick(ITEM_TYPES_BY_CATEGORY[category.id]);
  const adjective = pick(ITEM_ADJECTIVES);

  const requestedTier = request.rarity ? ITEM_RARITY_TIERS.indexOf(request.rarity) : -1;
  const rarity = !request.fullyRandom && requestedTier >= 0 ? request.rarity! : pick(ITEM_RARITY_TIERS);
  const tier = ITEM_RARITY_TIERS.indexOf(rarity);

  // Item type names are sometimes already compound ("Brass Compass",
  // "Music Box") — prepending a material adjective on top of those doubles
  // up on material ("Tarnished Silver Brass Compass") and reads like two
  // names collided. Multi-word types already carry their own material/
  // character, so they stand alone.
  const baseName = itemType.includes(" ") ? itemType : `${titleCase(adjective)} ${itemType}`;
  const generatedName = Math.random() < 0.4 ? `${baseName}, called ${pick(ITEM_EPITHETS)}` : baseName;
  const name = !request.fullyRandom && request.name ? request.name : generatedName;

  const bonusType = pickBonusType(category.id, tier);
  const { charges, rechargeRule } = computeCharges(category.id, tier);

  return {
    name,
    itemType,
    category: category.name,
    rarity,
    rarityTier: tier,
    description: `${article(adjective)} ${adjective} ${itemType.toLowerCase()}.`,
    property: pick(ITEM_PROPERTIES),
    history: pick(ITEM_HISTORIES),
    bonusType,
    bonusValue: computeBonusValue(tier, bonusType),
    requiresAttunement: bonusType === "none" ? false : computeAttunement(tier),
    charges,
    rechargeRule,
    value: computeValue(tier),
  };
}
