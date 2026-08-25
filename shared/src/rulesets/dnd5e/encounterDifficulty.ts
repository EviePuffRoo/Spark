import type { LiveCombatant } from "../../types.js";
import type { DifficultyResult, DifficultyRating } from "../types.js";

// Widely-used 5e-compatible XP budget guideline (DMG "Building a Combat
// Encounter"), not SRD text — same convention as the rest of the app's
// derived-content approach. [easy, medium, hard, deadly] per character level.
const ENCOUNTER_DIFFICULTY_XP_THRESHOLDS: Record<number, [number, number, number, number]> = {
  1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400],
  4: [125, 250, 375, 500], 5: [250, 500, 750, 1100], 6: [300, 600, 900, 1400],
  7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100], 9: [550, 1100, 1600, 2400],
  10: [600, 1200, 1900, 2800], 11: [800, 1600, 2400, 3600], 12: [1000, 2000, 3000, 4500],
  13: [1100, 2200, 3400, 5100], 14: [1250, 2500, 3800, 5700], 15: [1400, 2800, 4300, 6400],
  16: [1600, 3200, 4800, 7200], 17: [2000, 3900, 5900, 8800], 18: [2100, 4200, 6300, 9500],
  19: [2400, 4900, 7300, 10900], 20: [2800, 5700, 8500, 12700],
};

// Encounter XP multiplier by monster count, shifted one step per the
// "fewer than 3 / more than 5 party members" adjustment rule.
const MULTIPLIER_STEPS = [1, 1.5, 2, 2.5, 3, 4];
const MONSTER_COUNT_BREAKPOINTS = [1, 2, 3, 7, 11, 15];

function multiplierStepIndex(monsterCount: number): number {
  let index = 0;
  for (let i = 0; i < MONSTER_COUNT_BREAKPOINTS.length; i++) {
    if (monsterCount >= MONSTER_COUNT_BREAKPOINTS[i]) index = i;
  }
  return index;
}

export function computeEncounterDifficulty(combatants: LiveCombatant[]): DifficultyResult | null {
  const partyLevels = combatants.filter((c) => typeof c.level === "number").map((c) => c.level!);
  const monsterXp = combatants.filter((c) => typeof c.xp === "number").map((c) => c.xp!);
  if (partyLevels.length === 0 || monsterXp.length === 0) return null;

  const thresholds = partyLevels.reduce(
    (sum, level) => {
      const t = ENCOUNTER_DIFFICULTY_XP_THRESHOLDS[Math.min(20, Math.max(1, Math.round(level)))];
      return { easy: sum.easy + t[0], medium: sum.medium + t[1], hard: sum.hard + t[2], deadly: sum.deadly + t[3] };
    },
    { easy: 0, medium: 0, hard: 0, deadly: 0 },
  );

  let stepIndex = multiplierStepIndex(monsterXp.length);
  if (partyLevels.length < 3) stepIndex = Math.min(stepIndex + 1, MULTIPLIER_STEPS.length - 1);
  else if (partyLevels.length > 5) stepIndex = Math.max(stepIndex - 1, 0);
  const multiplier = MULTIPLIER_STEPS[stepIndex];

  const rawXp = monsterXp.reduce((a, b) => a + b, 0);
  const adjustedXp = Math.round(rawXp * multiplier);

  const rating: DifficultyRating =
    adjustedXp >= thresholds.deadly ? "deadly" :
    adjustedXp >= thresholds.hard ? "hard" :
    adjustedXp >= thresholds.medium ? "medium" :
    adjustedXp >= thresholds.easy ? "easy" : "trivial";

  return { rating, adjustedXp, thresholds };
}
