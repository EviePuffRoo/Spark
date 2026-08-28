import { PC_CLASSES, type PcClassDef } from "./data/classes.js";

// PlayerCharacterInput.className is free text (the DM can type anything),
// unlike the "generate" flow's dropdown which stores a PcClassDef id
// directly — so matching a live combatant back to its spellcasting data
// has to tolerate either "Wizard" or "wizard". A class that doesn't match
// (homebrew name, typo, or a non-caster) simply isn't treated as a
// caster, same lenient-degrade posture as parseSizeCategory/parseSpeedFeet
// use for monster stat blocks elsewhere in this app.
export function findCasterClass(className: string): PcClassDef | undefined {
  const needle = className.trim().toLowerCase();
  return PC_CLASSES.find((cls) => cls.id === needle || cls.name.toLowerCase() === needle);
}

// 5e spell save DC / spell attack bonus math: 8 (or 0) + proficiency bonus
// + the casting ability modifier. Computed once when a PC is added to an
// encounter and snapshotted onto the LiveCombatant (see
// LiveCombatant.spellSaveDc/spellAttackBonus in types.ts) — same
// once-at-add-time posture as attacks/legendaryActionsList.
export function computeSpellSaveDc(proficiencyBonus: number, abilityMod: number): number {
  return 8 + proficiencyBonus + abilityMod;
}

export function computeSpellAttackBonus(proficiencyBonus: number, abilityMod: number): number {
  return proficiencyBonus + abilityMod;
}
