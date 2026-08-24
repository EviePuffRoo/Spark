import type { BaseUpgradeCategory, BaseUpgradeDef } from "@spark/shared";

export const CATEGORY_LABELS: Record<BaseUpgradeCategory, string> = {
  defenses: "Defenses",
  trade: "Trade",
  influence: "Influence",
  comfort: "Comfort",
};

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as BaseUpgradeCategory[];

const ARCHETYPE_LABELS: Record<string, string> = {
  "general-store": "general store",
  "blacksmith": "blacksmith",
  "alchemist": "alchemist",
  "fletcher": "fletcher",
  "jeweler": "jeweler",
  "magic-curiosities": "curiosity shop",
  "tavern-sundries": "sundries stall",
  "outfitter": "outfitter",
};

// Turns an upgrade's structured effect into the exact mechanical benefit it
// grants — generated from the same data the purchase route acts on, so
// this can never drift out of sync with what actually happens. Shared
// between BasePanel (the purchase list) and BaseMapView (the map's detail
// panel) so the wording never diverges between the two.
export function describeEffect(def: BaseUpgradeDef): string | null {
  const effect = def.effect;
  if (!effect) return null;
  if (effect.kind === "defenseRating") return `+${effect.value} Defense Rating`;
  if (effect.kind === "shopUnlock") {
    const label = ARCHETYPE_LABELS[effect.archetype] ?? effect.archetype;
    const discount = effect.priceMultiplier && effect.priceMultiplier < 1
      ? `, ${Math.round((1 - effect.priceMultiplier) * 100)}% below market price`
      : "";
    return `Unlocks a real ${label} (~${effect.stockSize} items${discount}). Appears on the Shop tab the moment you buy this.`;
  }
  if (effect.kind === "reputationDelta") {
    const rival = effect.rivalValue !== undefined ? `, ${effect.rivalValue} with a rival you choose` : "";
    return `${effect.value >= 0 ? "+" : ""}${effect.value} reputation with a faction you choose${rival}. Applied immediately, both optional.`;
  }
  if (effect.kind === "restBonus") {
    return `+${effect.value} HP on every short rest taken by anyone in this world. Short rests otherwise heal nothing.`;
  }
  return null;
}
