// 5e concentration-save DC: 10, or half the damage taken (rounded down),
// whichever is higher.
export function computeConcentrationDc(damageTaken: number): number {
  return Math.max(10, Math.floor(damageTaken / 2));
}
