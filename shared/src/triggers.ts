import type { TriggerRule, TriggerCondition, LiveCombatant } from "./types.js";

// One fired rule — either bound to the combatant that satisfied it
// (hpBelowPercent/hpBelowValue/conditionApplied), or encounter-wide
// (roundReached, no combatantId).
export interface TriggerMatch {
  rule: TriggerRule;
  combatantId?: string;
  combatantName?: string;
}

function matchesTarget(condition: TriggerCondition, c: LiveCombatant): boolean {
  if (condition.targetKind && c.kind !== condition.targetKind) return false;
  if (condition.namePattern && !c.name.toLowerCase().includes(condition.namePattern.toLowerCase())) return false;
  return true;
}

// Pure and side-effect-free, same shape as isHostilePair/leftReach in
// opportunityAttack.ts — callers own deciding what to do with a match
// (show a reminder, let the DM dismiss or act on it) rather than this
// function ever mutating combat state itself.
export function evaluateTriggers(rules: TriggerRule[], combatants: LiveCombatant[], round: number): TriggerMatch[] {
  const matches: TriggerMatch[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const condition = rule.condition;

    if (condition.kind === "roundReached") {
      if (round >= (condition.threshold ?? 0)) matches.push({ rule });
      continue;
    }

    for (const c of combatants) {
      if (!matchesTarget(condition, c)) continue;

      if (condition.kind === "hpBelowPercent") {
        if (c.maxHp && c.maxHp > 0 && c.currentHp !== undefined && (c.currentHp / c.maxHp) * 100 <= (condition.threshold ?? 0)) {
          matches.push({ rule, combatantId: c.id, combatantName: c.name });
        }
      } else if (condition.kind === "hpBelowValue") {
        if (c.currentHp !== undefined && c.currentHp <= (condition.threshold ?? 0)) {
          matches.push({ rule, combatantId: c.id, combatantName: c.name });
        }
      } else if (condition.kind === "conditionApplied") {
        const needle = (condition.conditionName ?? "").toLowerCase().trim();
        if (needle && c.conditions.some((cc) => cc.name.toLowerCase().includes(needle))) {
          matches.push({ rule, combatantId: c.id, combatantName: c.name });
        }
      }
    }
  }
  return matches;
}
