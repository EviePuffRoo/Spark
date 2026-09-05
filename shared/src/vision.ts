import type { BattleMap, LiveCombatant, PlacedTile } from "./types.js";
import { BATTLE_TILE_BY_ID } from "./data/battleTiles.js";
import { FEET_PER_TILE } from "./gridMovement.js";
import { buildStandingIndex, cellKey as key, standingDefIn, standingTileAt } from "./mapCells.js";

// Baseline sight radius for a token with no explicit override — a
// generously-lit scene, the common case. DMs can shrink this per-combatant
// (LiveCombatant.visionRadiusFeet) for creatures limited to darkvision in
// an unlit area; there's no full lighting simulation here, just this one
// override knob.
export const DEFAULT_VISION_RADIUS_FEET = 60;

// A prebuilt "x,y" -> standing placement view of a map, so a whole vision
// pass scans the tile list once instead of once per cell it samples.
type StandingIndex = Map<string, PlacedTile>;

// Is there a door tile at this cell at all (open or closed)? Used by the
// server to validate a toggle-door request targets a real door.
export function isDoorTileAt(map: Pick<BattleMap, "tiles">, x: number, y: number): boolean {
  const placed = standingTileAt(map, x, y);
  return !!(placed && BATTLE_TILE_BY_ID[placed.tileId]?.isDoor);
}

// How far above a blocking tile's own authored height an observer must
// stand (or fly) before that specific tile stops blocking their sight —
// looking down over a low obstacle from a vantage point. Deliberately a
// single flat threshold, not true partial-height ray occlusion: only the
// observer's own elevation matters, not the target's, and nothing is
// interpolated along the ray. A blocker with NO authored elevation is
// never affected by this at all (see blocksSightAt) — every existing
// map, and every ordinary wall, is byte-for-byte unaffected by this
// feature until a DM deliberately stamps a height onto a blocker.
const ELEVATION_SIGHT_OVERRIDE_FEET = 10;

function blocksSightAt(index: StandingIndex, x: number, y: number, openDoors: Set<string> | undefined, observerElevationFeet: number): boolean {
  const def = standingDefIn(index, x, y, openDoors);
  if (!def?.blocksVision) return false;
  const tileElevation = index.get(key(x, y))?.elevation;
  if (tileElevation === undefined) return true;
  return observerElevationFeet < tileElevation + ELEVATION_SIGHT_OVERRIDE_FEET;
}

// Is the straight line from (x0,y0) to (x1,y1) unobstructed? Walks the
// line in sub-tile steps (fine enough that no cell the line actually
// passes through gets skipped) and fails as soon as an intermediate
// blocksVision tile is crossed. The destination cell itself is never
// checked here — you can always see a wall's near face, you just can't
// see past it — so a raycast against a wall tile correctly reports "the
// wall is visible" rather than "nothing beyond it is."
function hasLineOfSight(index: StandingIndex, x0: number, y0: number, x1: number, y1: number, openDoors?: Set<string>, observerElevationFeet?: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.max(Math.abs(dx), Math.abs(dy));
  if (dist === 0) return true;
  const resolvedElevation = observerElevationFeet ?? index.get(key(x0, y0))?.elevation ?? 0;
  const steps = dist * 4;
  let prevCx = x0;
  let prevCy = y0;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const cx = Math.floor(x0 + 0.5 + dx * t);
    const cy = Math.floor(y0 + 0.5 + dy * t);
    if (cx === x0 && cy === y0) continue;
    // Consecutive samples can jump diagonally from one cell straight to
    // another without ever landing on either of the two cells flanking the
    // corner between them — so a wall pair that meets corner-to-corner
    // (e.g. walls at (1,0) and (0,1) with open floor at (1,1)) would
    // otherwise leak sight straight through the gap between them. Block
    // the ray there too when both flanking cells are walls, same as a
    // squeezing-through-a-pinch-point rule.
    if (cx !== prevCx && cy !== prevCy && blocksSightAt(index, cx, prevCy, openDoors, resolvedElevation) && blocksSightAt(index, prevCx, cy, openDoors, resolvedElevation)) {
      return false;
    }
    prevCx = cx;
    prevCy = cy;
    if (cx === x1 && cy === y1) continue;
    if (blocksSightAt(index, cx, cy, openDoors, resolvedElevation)) return false;
  }
  return true;
}

// The core raycast: every cell within radiusTiles of the origin that has
// an unobstructed line back to it — derived straight from the map's own
// painted tiles (their blocksVision flag), never a manually-drawn wall
// layer. This is the whole point of the tileset system from Phase A: a
// DM builds the room, and line-of-sight just works.
export function computeVisibleCells(map: Pick<BattleMap, "width" | "height" | "tiles">, originX: number, originY: number, radiusTiles: number, openDoors?: Set<string>, observerElevationFeet?: number): Set<string> {
  return visibleCellsFrom(buildStandingIndex(map.tiles), map.width, map.height, originX, originY, radiusTiles, openDoors, observerElevationFeet);
}

// The same raycast against an index the caller already built. Every entry
// point that fires more than one cast (a party's shared vision, a map's
// light sources) goes through this so the index is built once per pass
// rather than once per token or torch.
function visibleCellsFrom(index: StandingIndex, width: number, height: number, originX: number, originY: number, radiusTiles: number, openDoors?: Set<string>, observerElevationFeet?: number): Set<string> {
  const visible = new Set<string>();
  visible.add(key(originX, originY));
  const r = Math.ceil(radiusTiles);
  const rSquared = radiusTiles * radiusTiles;
  for (let dy = -r; dy <= r; dy++) {
    const y = originY + dy;
    if (y < 0 || y >= height) continue;
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > rSquared) continue;
      const x = originX + dx;
      if (x < 0 || x >= width) continue;
      if (hasLineOfSight(index, originX, originY, x, y, openDoors, observerElevationFeet)) visible.add(key(x, y));
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
export function computeVisionForTokens(map: Pick<BattleMap, "width" | "height" | "tiles">, tokens: Pick<LiveCombatant, "kind" | "gridX" | "gridY" | "visionRadiusFeet" | "flying">[], openDoors?: Set<string>): Set<string> {
  const index = buildStandingIndex(map.tiles);
  const visible = new Set<string>();
  for (const t of tokens) {
    if (t.kind !== "playerCharacter" || t.gridX === undefined || t.gridY === undefined) continue;
    const radiusTiles = feetToTiles(t.visionRadiusFeet ?? DEFAULT_VISION_RADIUS_FEET);
    const observerElevationFeet = t.flying ? Number.POSITIVE_INFINITY : undefined;
    for (const k of visibleCellsFrom(index, map.width, map.height, t.gridX, t.gridY, radiusTiles, openDoors, observerElevationFeet)) visible.add(k);
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
//
// `carriers` is optional and covers the same mechanic for a combatant
// carrying their own light (a torch, a lantern) rather than one painted
// into the map — same "already visible" gate, same single pass, just
// sourced from a token's current position instead of a fixed tile.
export function extendWithLightSources(
  map: Pick<BattleMap, "width" | "height" | "tiles">,
  baseVisible: Set<string>,
  carriers?: Pick<LiveCombatant, "gridX" | "gridY" | "lightRadiusFeet" | "flying">[],
  openDoors?: Set<string>,
): Set<string> {
  const index = buildStandingIndex(map.tiles);
  const extended = new Set(baseVisible);
  // Decor and gmOnly are excluded — a cosmetic tile must never light a
  // room, and a DM marker must never reveal one. A span (a lit bridge)
  // counts, same as it counts for movement and sight.
  for (const tile of map.tiles) {
    const layer = tile.layer ?? "floor";
    if (layer === "decor" || layer === "gmOnly") continue;
    const def = BATTLE_TILE_BY_ID[tile.tileId];
    if (!def?.lightRadius || !baseVisible.has(key(tile.x, tile.y))) continue;
    for (const k of visibleCellsFrom(index, map.width, map.height, tile.x, tile.y, def.lightRadius, openDoors)) extended.add(k);
  }
  for (const c of carriers ?? []) {
    if (!c.lightRadiusFeet || c.gridX === undefined || c.gridY === undefined) continue;
    if (!baseVisible.has(key(c.gridX, c.gridY))) continue;
    const observerElevationFeet = c.flying ? Number.POSITIVE_INFINITY : undefined;
    for (const k of visibleCellsFrom(index, map.width, map.height, c.gridX, c.gridY, feetToTiles(c.lightRadiusFeet), openDoors, observerElevationFeet)) extended.add(k);
  }
  return extended;
}
