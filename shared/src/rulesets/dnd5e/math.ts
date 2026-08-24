// Core D&D 5e ability-score math — the piece of "what game system are we
// running" that was previously duplicated verbatim in five different
// files (the PC generator, two stat-block card views, the combatant
// initiative roller, and the level-up route) instead of living in one
// place. Pulled out here first, ahead of anything else in the eventual
// ruleset abstraction, because it's the smallest, most self-contained,
// and most-duplicated piece — see rulesets/index.ts for how this plugs
// into a RulesetDefinition.
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

// The same modifier, formatted the way it's shown next to an ability
// score on a stat block: a leading sign always present, even at +0.
export function formatModifier(score: number): string {
  const mod = abilityModifier(score);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}
