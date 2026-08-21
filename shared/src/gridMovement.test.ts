import { describe, it, expect } from "vitest";
import { chebyshevDistanceFeet, computeReachableCells, FEET_PER_TILE } from "./gridMovement.js";
import type { BattleMap } from "./types.js";

function emptyMap(width: number, height: number, tiles: BattleMap["tiles"] = []): Pick<BattleMap, "width" | "height" | "tiles"> {
  return { width, height, tiles };
}

describe("chebyshevDistanceFeet", () => {
  it("is zero for the same cell", () => {
    expect(chebyshevDistanceFeet(3, 3, 3, 3)).toBe(0);
  });

  it("costs 5ft per step on a straight orthogonal line", () => {
    expect(chebyshevDistanceFeet(0, 0, 4, 0)).toBe(4 * FEET_PER_TILE);
  });

  it("costs 5ft per step on a pure diagonal, not the sum of both axes", () => {
    expect(chebyshevDistanceFeet(0, 0, 3, 3)).toBe(3 * FEET_PER_TILE);
  });

  it("uses the larger axis for a mixed diagonal+orthogonal move", () => {
    expect(chebyshevDistanceFeet(0, 0, 5, 2)).toBe(5 * FEET_PER_TILE);
  });
});

describe("computeReachableCells", () => {
  it("always includes the origin", () => {
    const reachable = computeReachableCells(emptyMap(10, 10), 5, 5, 0);
    expect(reachable.has("5,5")).toBe(true);
    expect(reachable.size).toBe(1);
  });

  it("reaches every cell within an open floor's speed radius (chebyshev)", () => {
    const reachable = computeReachableCells(emptyMap(10, 10), 5, 5, 10);
    // 10ft speed = 2 tiles at 5ft/step in every direction
    expect(reachable.has("7,5")).toBe(true);
    expect(reachable.has("3,5")).toBe(true);
    expect(reachable.has("7,7")).toBe(true);
    expect(reachable.has("8,5")).toBe(false);
  });

  it("does not cross a blocksMovement tile", () => {
    const map = emptyMap(10, 10, [{ x: 6, y: 5, tileId: "stone-wall" }]);
    const reachable = computeReachableCells(map, 5, 5, 30);
    expect(reachable.has("6,5")).toBe(false);
    // Still reachable via a route around the single wall tile.
    expect(reachable.has("6,4")).toBe(true);
  });

  it("charges double cost for difficult terrain, halving effective range", () => {
    // Wall off the diagonals around the difficult tile so the only route
    // east is straight through it — otherwise an 8-directional flood fill
    // can just step around a single difficult tile for the same cost.
    const map = emptyMap(10, 10, [
      { x: 6, y: 5, tileId: "water" },
      { x: 6, y: 4, tileId: "stone-wall" },
      { x: 6, y: 6, tileId: "stone-wall" },
    ]);
    const reachable = computeReachableCells(map, 5, 5, 10);
    // 10ft budget: stepping onto the difficult (6,5) costs 10ft exactly —
    // reachable — but going one further (7,5) would need another 5ft+.
    expect(reachable.has("6,5")).toBe(true);
    expect(reachable.has("7,5")).toBe(false);
  });

  it("stays in bounds", () => {
    const reachable = computeReachableCells(emptyMap(3, 3), 0, 0, 100);
    for (const key of reachable) {
      const [x, y] = key.split(",").map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(3);
      expect(y).toBeLessThan(3);
    }
  });
});
