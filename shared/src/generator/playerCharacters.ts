import {
  PC_CLASSES, PC_STANDARD_ARRAY, FULL_CASTER_SLOTS, HALF_CASTER_SLOTS, PACT_MAGIC_SLOTS,
  type ArmorTier, type PcClassDef,
} from "../data/classes.js";
import { RACES } from "../data/races.js";
import { nameListFor } from "../data/names.js";
import { pick } from "./random.js";
import type { GeneratePlayerCharacterRequest, GeneratedPlayerCharacter, AbilityScores, SpellSlotLevel, ClassResource } from "../types.js";
import { getRuleset } from "../rulesets/index.js";

function assignStandardArray(priority: string[]): AbilityScores {
  const scores: Record<string, number> = {};
  priority.forEach((ability, i) => { scores[ability] = PC_STANDARD_ARRAY[i]; });
  return scores as unknown as AbilityScores;
}

function computeHp(hitDie: number, level: number, conMod: number): number {
  const perLevelAverage = Math.floor(hitDie / 2) + 1 + conMod;
  return Math.max(1, hitDie + conMod + (level - 1) * perLevelAverage);
}

function computeArmorClass(typicalArmor: ArmorTier, typicalShield: boolean, dexMod: number): number {
  let ac: number;
  switch (typicalArmor) {
    case "light": ac = 11 + dexMod; break;
    case "medium": ac = 13 + Math.min(dexMod, 2); break;
    case "heavy": ac = 16; break;
    default: ac = 10 + dexMod;
  }
  return typicalShield ? ac + 2 : ac;
}

export function computeSpellSlots(pcClass: PcClassDef, level: number): SpellSlotLevel[] {
  if (!pcClass.casterType) return [];
  const idx = Math.min(19, Math.max(0, Math.trunc(level) - 1));
  if (pcClass.casterType === "pact") {
    const p = PACT_MAGIC_SLOTS[idx];
    return p.count > 0 ? [{ level: p.slotLevel, max: p.count, current: p.count }] : [];
  }
  const table = pcClass.casterType === "full" ? FULL_CASTER_SLOTS : HALF_CASTER_SLOTS;
  return table[idx]
    .map((count, i) => ({ level: i + 1, max: count, current: count }))
    .filter((s) => s.max > 0);
}

export function computeClassResource(pcClass: PcClassDef, level: number): ClassResource | undefined {
  if (!pcClass.resource) return undefined;
  const idx = Math.min(19, Math.max(0, Math.trunc(level) - 1));
  const max = pcClass.resource.countByLevel[idx];
  if (max <= 0) return undefined;
  return { name: pcClass.resource.name, max, current: max, rechargeOn: pcClass.resource.rechargeOn };
}

// A stored PlayerCharacter's className is free text (it's whatever the
// generator's pcClass.name was, or whatever a homebrew/imported character
// typed) rather than a PC_CLASSES id — a level-up on a class that doesn't
// match any known entry falls back to a flat d8 hit die for the HP math
// and leaves spellSlots/classResources untouched (classMatched: false),
// rather than guessing at rules the app has no table for.
const FALLBACK_HIT_DIE = 8;

export interface LevelUpChanges {
  hpGain: number;
  spellSlots: SpellSlotLevel[];
  classResource: ClassResource | undefined;
  proficiencyBonus: number;
  classMatched: boolean;
}

// The delta this level-up applies on top of whatever a character's current
// maxHp/spellSlots/etc. already are — never a from-scratch recompute, so a
// manually-tweaked current HP or homebrewed slot count from before this
// level-up is preserved rather than overwritten. Spell slots and the class
// resource, when the class is known, refresh to their new full values
// (leveling up is assumed to happen between sessions/after a rest).
export function computeLevelUpChanges(pcClass: PcClassDef | undefined, fromLevel: number, toLevel: number, conMod: number): LevelUpChanges {
  const hitDie = pcClass?.hitDie ?? FALLBACK_HIT_DIE;
  const proficiencyBonus = getRuleset().proficiencyBonusForLevel(toLevel);
  return {
    hpGain: computeHp(hitDie, toLevel, conMod) - computeHp(hitDie, fromLevel, conMod),
    spellSlots: pcClass ? computeSpellSlots(pcClass, toLevel) : [],
    classResource: pcClass ? computeClassResource(pcClass, toLevel) : undefined,
    proficiencyBonus,
    classMatched: !!pcClass,
  };
}

export function generatePlayerCharacter(request: GeneratePlayerCharacterRequest = {}): GeneratedPlayerCharacter {
  const pcClass =
    !request.fullyRandom && request.className
      ? PC_CLASSES.find((c) => c.id === request.className) ?? pick(PC_CLASSES)
      : pick(PC_CLASSES);

  const race =
    !request.fullyRandom && request.race
      ? RACES.find((r) => r.id === request.race) ?? pick(RACES)
      : pick(RACES);

  const level = !request.fullyRandom && request.level ? Math.min(20, Math.max(1, Math.trunc(request.level))) : 1;

  const abilityScores = assignStandardArray(pcClass.abilityPriority);
  const ruleset = getRuleset();
  const conMod = ruleset.abilityModifier(abilityScores.con);
  const dexMod = ruleset.abilityModifier(abilityScores.dex);

  const { first, last } = nameListFor(race.id);
  const name = `${pick(first)} ${pick(last)}`;

  const resource = computeClassResource(pcClass, level);

  return {
    name,
    className: pcClass.name,
    level,
    race: race.name,
    armorClass: computeArmorClass(pcClass.typicalArmor, pcClass.typicalShield, dexMod),
    maxHp: computeHp(pcClass.hitDie, level, conMod),
    abilityScores,
    spellSlots: computeSpellSlots(pcClass, level),
    classResources: resource ? [resource] : [],
  };
}
