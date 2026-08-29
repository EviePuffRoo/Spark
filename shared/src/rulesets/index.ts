import { dnd5eRuleset } from "./dnd5e/index.js";
import type { RulesetDefinition } from "./types.js";

export * from "./types.js";
export * from "./dnd5e/index.js";
export * from "./houseRules.js";

const RULESETS: Record<string, RulesetDefinition> = {
  dnd5e: dnd5eRuleset,
};

// Every World in Spark today is implicitly a D&D 5e world — there's no
// World.rulesetId field yet, so this always resolves to dnd5eRuleset.
// Accepting an optional id now (rather than a bare `dnd5eRuleset` export)
// means call sites that will eventually pass a world's chosen ruleset
// don't need to change shape later, only what they pass in.
export function getRuleset(id?: string): RulesetDefinition {
  return (id && RULESETS[id]) || dnd5eRuleset;
}
