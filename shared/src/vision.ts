import type { BattleMap, LiveCombatant, TileDef } from "./types.js";
import { BATTLE_TILE_BY_ID } from "./data/battleTiles.js";
import { FEET_PER_TILE } from "./gridMovement.js";

// Baseline sight radius for a token with no explicit override — a
// generously-lit scene, the common case. DMs can shrink this per-combatant
// (LiveCombatant.visionRadiusFeet) for creatures limited to darkvision in
// an unlit area; there's no full lighting simulation here, just this one
// override knob.
export const DEFAULT_VISION_RADIUS_FEET = 60;

function tileAt(map: Pick<BattleMap, "tiles">, x: number, y: number): TileDef | undefined {
  const placed = map.tiles.find((t) => t.x === x && t.y === y && (t.layer ?? "floor") === "floor");
  return placed ? BATTLE_TILE_BY_ID[placed.tileId] : undefined;
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

// Is the straight line from (x0,y0) to (x1,y1) unobstructed? Walks the
// line in sub-tile steps (fine enough that no cell the line actually
// passes through gets skipped) and fails as soon as an intermediate
// blocksVision tile is crossed. The destination cell itself is never
// checked here — you can always see a wall's near face, you just can't
// see past it — so a raycast against a wall tile correctly reports "the
// wall is visible" rather than "nothing beyond it is."
function hasLineOfSight(map: Pick<BattleMap, "tiles">, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.max(Math.abs(dx), Math.abs(dy));
  if (dist === 0) return true;
  const steps = dist * 4;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const cx = Math.floor(x0 + 0.5 + dx * t);
    const cy = Math.floor(y0 + 0.5 + dy * t);
    if (cx === x1 && cy === y1) continue;
    if (cx === x0 && cy === y0) continue;
    if (tileAt(map, cx, cy)?.blocksVision) return false;
  }
  return true;
}

// The core raycast: every cell within radiusTiles of the origin that has
// an unobstructed line back to it — derived straight from the map's own
// painted tiles (their blocksVision flag), never a manually-drawn wall
// layer. This is the whole point of the tileset system from Phase A: a
// DM builds the room, and line-of-sight just works.
export function computeVisibleCells(map: Pick<BattleMap, "width" | "height" | "tiles">, originX: number, originY: number, radiusTiles: number): Set<string> {
  const visible = new Set<string>();
  visible.add(key(originX, originY));
  const r = Math.ceil(radiusTiles);
  const rSquared = radiusTiles * radiusTiles;
  for (let dy = -r; dy <= r; dy++) {
    const y = originY + dy;
    if (y < 0 || y >= map.height) continue;
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > rSquared) continue;
      const x = originX + dx;
      if (x < 0 || x >= map.width) continue;
      if (hasLineOfSight(map, originX, originY, x, y)) visible.add(key(x, y));
    }
  }
  return visible;
}

function feetToTiles(feet: number): number {
  return feet / FEET_PER_TILE;
}

// The party's shared, collective vision — every player-character token's
// own sight, unioned together. Monsters and custom combatants don't
// contribute: fog-of-war is a player-facing memory of what the PARTY has
// seen, not a simulation of every creature's eyesight.
export function computeVisionForTokens(map: Pick<BattleMap, "width" | "height" | "tiles">, tokens: Pick<LiveCombatant, "kind" | "gridX" | "gridY" | "visionRadiusFeet">[]): Set<string> {
  const visible = new Set<string>();
  for (const t of tokens) {
    if (t.kind !== "playerCharacter" || t.gridX === undefined || t.gridY === undefined) continue;
    const radiusTiles = feetToTiles(t.visionRadiusFeet ?? DEFAULT_VISION_RADIUS_FEET);
    for (const k of computeVisibleCells(map, t.gridX, t.gridY, radiusTiles)) visible.add(k);
  }
  return visible;
}

// A light source only extends sight once the party can already see the
// tile it's on — otherwise a torch sitting in a room nobody's found yet
// would eerily pre-reveal that room. Deliberately a single pass (a
// newly-lit cell from one torch doesn't in turn light up a second torch
// further away) — simple, predictable, and enough of a "wow" on its own:
// a lit torch down a dark hallway genuinely lets the party see past
// their own vision radius, exactly the way a real light source would.
export function extendWithLightSources(map: Pick<BattleMap, "width" | "height" | "tiles">, baseVisible: Set<string>): Set<string> {
  const extended = new Set(baseVisible);
  for (const tile of map.tiles) {
    if ((tile.layer ?? "floor") !== "floor") continue;
    const def = BATTLE_TILE_BY_ID[tile.tileId];
    if (!def?.lightRadius || !baseVisible.has(key(tile.x, tile.y))) continue;
    for (const k of computeVisibleCells(map, tile.x, tile.y, def.lightRadius)) extended.add(k);
  }
  return extended;
}
