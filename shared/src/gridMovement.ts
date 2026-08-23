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

function tileAt(map: Pick<BattleMap, "tiles">, x: number, y: number): TileDef | undefined {
  const placed = map.tiles.find((t) => t.x === x && t.y === y && (t.layer ?? "floor") === "floor");
  return placed ? BATTLE_TILE_BY_ID[placed.tileId] : undefined;
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

    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const tile = tileAt(map, nx, ny);
      if (tile?.blocksMovement) continue;

      const stepCost = tile?.difficultTerrain ? FEET_PER_TILE * 2 : FEET_PER_TILE;
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
