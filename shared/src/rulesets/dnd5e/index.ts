import { abilityModifier, formatModifier, proficiencyBonusForLevel } from "./math.js";
import { computeEncounterDifficulty } from "./encounterDifficulty.js";
import type { RulesetDefinition } from "../types.js";

export * from "./math.js";
export * from "./encounterDifficulty.js";

export const dnd5eRuleset: RulesetDefinition = {
  id: "dnd5e",
  name: "Dungeons & Dragons 5th Edition",
  abilityModifier,
  formatModifier,
  proficiencyBonusForLevel,
  computeEncounterDifficulty,
};
