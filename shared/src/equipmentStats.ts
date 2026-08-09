import type { Item } from "./types.js";

export interface EquipmentBonuses {
  armorClass: number;
  attackAndDamage: number;
  savingThrows: number;
  abilityChecks: number;
  spellSaveDc: number;
}

const BLANK_BONUSES: EquipmentBonuses = {
  armorClass: 0, attackAndDamage: 0, savingThrows: 0, abilityChecks: 0, spellSaveDc: 0,
};

// An attunement-required item only contributes its bonus while attuned —
// merely equipping it isn't enough, matching the 5e attunement convention.
export function computeEquipmentBonuses(items: Item[], equippedIds: string[], attunedIds: string[]): EquipmentBonuses {
  const bonuses = { ...BLANK_BONUSES };
  for (const item of items) {
    if (!equippedIds.includes(item.id)) continue;
    if (item.requiresAttunement && !attunedIds.includes(item.id)) continue;
    if (item.bonusType === "none") continue;
    bonuses[item.bonusType] += item.bonusValue;
  }
  return bonuses;
}
