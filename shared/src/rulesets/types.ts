// The contract a game system must satisfy to plug into Spark's generators
// and character sheets in place of the built-in D&D 5e ruleset — see
// dnd5e/index.ts for the reference implementation. Deliberately starts
// tiny: the ability-modifier math is the first (and, for now, only)
// piece extracted out of code that used to hardcode 5e's formula
// directly. Widen this interface incrementally as more 5e-specific logic
// (proficiency-bonus-by-level, CR/XP tables, class/spell data, stat-block
// field schemas) gets pulled out of the generators and views that
// currently hardcode it — see the "Ruleset Plugin System" architecture
// scope for the intended end state. Every addition here needs a matching
// value on dnd5eRuleset before anything can consume it.
export interface RulesetDefinition {
  id: string;
  name: string;
  abilityModifier(score: number): number;
  formatModifier(score: number): string;
}
