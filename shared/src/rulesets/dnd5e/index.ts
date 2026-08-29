import { abilityModifier, formatModifier, proficiencyBonusForLevel, carryCapacityLbs } from "./math.js";
import { computeEncounterDifficulty } from "./encounterDifficulty.js";
import { POINT_BUY_BUDGET } from "../../data/skills.js";
import type { RulesetDefinition } from "../types.js";

export * from "./math.js";
export * from "./encounterDifficulty.js";

export const dnd5eRuleset: RulesetDefinition = {
  id: "dnd5e",
  name: "Dungeons & Dragons 5th Edition",
  abilityModifier,
  formatModifier,
  proficiencyBonusForLevel,
  carryCapacityLbs,
  pointBuyBudget: POINT_BUY_BUDGET,
  computeEncounterDifficulty,
};
