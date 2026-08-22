// Two combatants are on opposing sides for this purely-a-reminder purpose
// if exactly one of them is a player character — matches the same PC vs.
// everything-else split already used elsewhere in combat (e.g. difficulty
// calc, loot-drop gating).
export function isHostilePair(a: { kind: string }, b: { kind: string }): boolean {
  return (a.kind === "playerCharacter") !== (b.kind === "playerCharacter");
}

function chebyshevCells(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

// Reach is approximated as adjacency (1 cell / 5 ft) from the mover's
// center cell — footprint size isn't factored in, since this only drives
// a dismissible DM reminder, not an enforced rule.
export function leftReach(
  before: { x: number; y: number },
  after: { x: number; y: number },
  otherX: number,
  otherY: number
): boolean {
  const wasAdjacent = chebyshevCells(before.x, before.y, otherX, otherY) <= 1;
  const stillAdjacent = chebyshevCells(after.x, after.y, otherX, otherY) <= 1;
  return wasAdjacent && !stillAdjacent;
}
