import { abilityModifier, formatModifier } from "./math.js";
import type { RulesetDefinition } from "../types.js";

export * from "./math.js";

export const dnd5eRuleset: RulesetDefinition = {
  id: "dnd5e",
  name: "Dungeons & Dragons 5th Edition",
  abilityModifier,
  formatModifier,
};
