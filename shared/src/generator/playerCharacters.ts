import { PC_CLASSES, PC_STANDARD_ARRAY, type ArmorTier } from "../data/classes.js";
import { RACES } from "../data/races.js";
import { nameListFor } from "../data/names.js";
import { pick } from "./random.js";
import type { GeneratePlayerCharacterRequest, PlayerCharacterInput, AbilityScores } from "../types.js";

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

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

export function generatePlayerCharacter(request: GeneratePlayerCharacterRequest = {}): PlayerCharacterInput {
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
  const conMod = abilityModifier(abilityScores.con);
  const dexMod = abilityModifier(abilityScores.dex);

  const { first, last } = nameListFor(race.id);
  const name = `${pick(first)} ${pick(last)}`;

  return {
    name,
    className: pcClass.name,
    level,
    race: race.name,
    armorClass: computeArmorClass(pcClass.typicalArmor, pcClass.typicalShield, dexMod),
    maxHp: computeHp(pcClass.hitDie, level, conMod),
    abilityScores,
  };
}
