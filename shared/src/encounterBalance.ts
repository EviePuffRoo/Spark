import type { LiveCombatant } from "./types.js";
import type { ParsedAttack } from "./statBlockAttacks.js";

export interface EncounterBalanceReport {
  partyCount: number;
  monsterCount: number;
  // monsterCount / partyCount; null when there's no party to divide by.
  actionEconomyRatio: number | null;
  // True once monsters outnumber the party by more than OUTNUMBERED_RATIO —
  // the XP budget alone under-warns about this: a fight against many
  // weaker attackers reads far more dangerous at the table than its XP
  // total suggests, since more simultaneous attacks means more chances to
  // land a hit before anyone can react or retreat.
  partyOutnumbered: boolean;
  partyTotalHp: number;
  monsterTotalHp: number;
  // Expected hit-point damage the party takes if every monster takes one
  // round of action — a single expected-value estimate (see
  // expectedAttackDamage below), not a dice-by-dice simulation.
  expectedDamagePerRound: number;
  // partyTotalHp / expectedDamagePerRound, rounded down; null when no
  // damage is expected this round (nothing to divide by).
  roundsUntilPartyDowned: number | null;
}

// No PC ability scores are snapshotted onto LiveCombatant (only
// armorClass), so a save-based attack's real chance to land can't be
// computed from party stats the way an attack roll's can against AC —
// this is a flat, documented planning assumption rather than a real
// simulation of the party's actual save bonuses.
const ASSUMED_SAVE_SUCCESS_CHANCE = 0.5;
const OUTNUMBERED_RATIO = 1.5;
const DEFAULT_TARGET_AC = 15;

function averageDiceDamage(notation: string): number {
  const match = notation.match(/^\s*(\d*)d(\d+)\s*([+-]\s*\d+)?\s*$/i);
  if (!match) return 0;
  const count = match[1] ? Number(match[1]) : 1;
  const sides = Number(match[2]);
  const modifier = match[3] ? Number(match[3].replace(/\s+/g, "")) : 0;
  return count * ((sides + 1) / 2) + modifier;
}

// Same natural-1-always-misses / natural-20-always-hits floor and ceiling
// every d20 roll in this app already assumes.
function hitChance(toHitBonus: number, targetAc: number): number {
  const neededRoll = targetAc - toHitBonus;
  return Math.min(0.95, Math.max(0.05, (21 - neededRoll) / 20));
}

// Assumes one use of this attack per round — a monster whose Multiattack
// swings the same named attack twice is undercounted here, the same
// "reminder aid, not an enforced simulation" tradeoff opportunityAttack.ts
// and the concentration DC reminder already make elsewhere in combat.
function expectedAttackDamage(attack: ParsedAttack, targetAc: number): number {
  if (!attack.damageDice) return 0;
  const avgDamage = averageDiceDamage(attack.damageDice);
  if (attack.toHitBonus !== null) return avgDamage * hitChance(attack.toHitBonus, targetAc);
  if (attack.savingThrow) return avgDamage * (1 - ASSUMED_SAVE_SUCCESS_CHANCE);
  return 0;
}

export function analyzeEncounterBalance(combatants: LiveCombatant[]): EncounterBalanceReport {
  const party = combatants.filter((c) => c.kind === "playerCharacter");
  const monsters = combatants.filter((c) => c.kind !== "playerCharacter");

  const partyTotalHp = party.reduce((sum, c) => sum + (c.currentHp ?? c.maxHp ?? 0), 0);
  const monsterTotalHp = monsters.reduce((sum, c) => sum + (c.currentHp ?? c.maxHp ?? 0), 0);

  const partyAcs = party.map((c) => c.armorClass).filter((ac): ac is number => typeof ac === "number");
  const targetAc = partyAcs.length > 0 ? partyAcs.reduce((a, b) => a + b, 0) / partyAcs.length : DEFAULT_TARGET_AC;

  const expectedDamagePerRound = monsters.reduce(
    (sum, c) => sum + (c.attacks ?? []).reduce((s, a) => s + expectedAttackDamage(a, targetAc), 0),
    0
  );

  const actionEconomyRatio = party.length > 0 ? monsters.length / party.length : null;
  // Rounded once, then rounds-until-downed is derived from that same
  // rounded figure — so the two numbers a DM reads side by side always
  // agree (e.g. "1.0 dmg/round" implies exactly 20 rounds for 20 HP,
  // never an off-by-one from rounding the display value after the fact).
  const roundedDamagePerRound = Math.round(expectedDamagePerRound * 10) / 10;

  return {
    partyCount: party.length,
    monsterCount: monsters.length,
    actionEconomyRatio,
    partyOutnumbered: actionEconomyRatio !== null && actionEconomyRatio > OUTNUMBERED_RATIO,
    partyTotalHp,
    monsterTotalHp,
    expectedDamagePerRound: roundedDamagePerRound,
    roundsUntilPartyDowned: roundedDamagePerRound > 0 ? Math.floor(partyTotalHp / roundedDamagePerRound) : null,
  };
}
