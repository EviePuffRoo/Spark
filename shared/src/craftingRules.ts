// DMG-style magic item crafting math: a day per 25gp of market value (minimum
// one day), spending half the item's value in materials over that time.
export function computeCraftingCost(item: { value: number }): { goldCost: number; daysRequired: number } {
  const value = Math.max(0, item.value);
  return {
    goldCost: Math.ceil(value / 2),
    daysRequired: Math.max(1, Math.ceil(value / 25)),
  };
}
