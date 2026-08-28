import type { BattleMap, TileDef } from "./types.js";
import { BATTLE_TILE_BY_ID } from "./data/battleTiles.js";

export const FEET_PER_TILE = 5;

// Straight-line distance between two grid cells, in feet — the "every
// diagonal step costs 5 ft" convention (one of the two official 5e DMG
// variant movement rules, the simpler alternative to the default
// alternating 5/10 ft rule), used for the ruler tool where the path is
// assumed to be a direct, unobstructed line.
export function chebyshevDistanceFeet(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by)) * FEET_PER_TILE;
}

// An open door (its "x,y" key present in openDoors) reads as fully passable
// regardless of its base (closed) def — see TileDef.isDoor.
function tileAt(map: Pick<BattleMap, "tiles">, x: number, y: number, openDoors?: Set<string>): TileDef | undefined {
  const placed = map.tiles.find((t) => t.x === x && t.y === y && (t.layer ?? "floor") === "floor");
  if (!placed) return undefined;
  const def = BATTLE_TILE_BY_ID[placed.tileId];
  if (def?.isDoor && openDoors?.has(`${x},${y}`)) {
    return { ...def, blocksMovement: false, blocksVision: false };
  }
  return def;
}

// A cell's authored height in feet, or undefined if the DM never stamped
// one (see PlacedTile.elevation). Only the floor layer carries mechanical
// weight, same rule as tileAt above.
export function elevationAt(map: Pick<BattleMap, "tiles">, x: number, y: number): number | undefined {
  const placed = map.tiles.find((t) => t.x === x && t.y === y && (t.layer ?? "floor") === "floor");
  return placed?.elevation;
}

// Dijkstra flood-fill over the map's grid (8-directional, same flat 5ft-
// per-step rule as chebyshevDistanceFeet above) honoring each tile's own
// blocksMovement/difficultTerrain — this is the "beyond a ruler" piece:
// what a token can actually reach this turn given the walls and terrain
// that have been painted, not just raw distance. Bare (unpainted) cells
// are plain floor. Returns the set of "x,y" keys reachable within budget,
// always including the origin itself.
export function computeReachableCells(
  map: Pick<BattleMap, "width" | "height" | "tiles">,
  originX: number,
  originY: number,
  speedFeet: number,
  openDoors?: Set<string>,
  flying?: boolean,
): Set<string> {
  const key = (x: number, y: number) => `${x},${y}`;
  const dist = new Map<string, number>();
  dist.set(key(originX, originY), 0);
  const frontier: { x: number; y: number; cost: number }[] = [{ x: originX, y: originY, cost: 0 }];
  const dirs = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost);
    const cur = frontier.shift()!;
    if ((dist.get(key(cur.x, cur.y)) ?? Infinity) < cur.cost) continue;
    const curElevation = elevationAt(map, cur.x, cur.y) ?? 0;

    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const tile = tileAt(map, nx, ny, openDoors);
      const nextElevation = elevationAt(map, nx, ny) ?? 0;
      // A flying combatant crosses an authored gap (negative elevation —
      // a chasm floor, a pit) freely; it still can't fly through a solid
      // obstacle (a wall, a pillar), which blocksMovement independent of
      // elevation. An ordinary chasm placement with no elevation stamped
      // on it continues to block everyone, flying included — the DM
      // opts into "this is an open-air drop, not a wall" by giving it a
      // negative height.
      const isFlyableGap = flying === true && nextElevation < 0;
      if (tile?.blocksMovement && !isFlyableGap) continue;

      const climbing = flying !== true && nextElevation !== curElevation;
      const stepCost = (tile?.difficultTerrain || climbing) ? FEET_PER_TILE * 2 : FEET_PER_TILE;
      const nextCost = cur.cost + stepCost;
      if (nextCost > speedFeet) continue;

      const nk = key(nx, ny);
      if (nextCost < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nextCost);
        frontier.push({ x: nx, y: ny, cost: nextCost });
      }
    }
  }

  return new Set(dist.keys());
}
