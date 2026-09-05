import { describe, it, expect } from "vitest";
import { chebyshevDistanceFeet, computeReachableCells, FEET_PER_TILE } from "./gridMovement.js";
import { elevationAt, groundTileAt, standingTileAt } from "./mapCells.js";
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

  it("ignores a blocksMovement tile placed on the decor layer", () => {
    const map = emptyMap(10, 10, [{ x: 6, y: 5, tileId: "stone-wall", layer: "decor" }]);
    const reachable = computeReachableCells(map, 5, 5, 30);
    expect(reachable.has("6,5")).toBe(true);
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

  it("blocks movement through a closed door by default", () => {
    const map = emptyMap(10, 10, [{ x: 6, y: 5, tileId: "wooden-door" }]);
    const reachable = computeReachableCells(map, 5, 5, 30);
    expect(reachable.has("6,5")).toBe(false);
  });

  it("allows movement through the door once it's toggled open", () => {
    const map = emptyMap(10, 10, [{ x: 6, y: 5, tileId: "wooden-door" }]);
    const reachable = computeReachableCells(map, 5, 5, 30, new Set(["6,5"]));
    expect(reachable.has("6,5")).toBe(true);
  });
});

describe("elevationAt", () => {
  it("is undefined for a cell with no placed tile", () => {
    expect(elevationAt(emptyMap(10, 10), 3, 3)).toBeUndefined();
  });

  it("is undefined for a placed tile that never had elevation stamped", () => {
    const map = emptyMap(10, 10, [{ x: 3, y: 3, tileId: "grass" }]);
    expect(elevationAt(map, 3, 3)).toBeUndefined();
  });

  it("returns the stamped value, including an explicit 0", () => {
    const map = emptyMap(10, 10, [
      { x: 3, y: 3, tileId: "grass", elevation: 0 },
      { x: 4, y: 3, tileId: "grass", elevation: 15 },
    ]);
    expect(elevationAt(map, 3, 3)).toBe(0);
    expect(elevationAt(map, 4, 3)).toBe(15);
  });
});

describe("elevation", () => {
  it("charges double cost for stepping onto a differently-elevated cell", () => {
    // Same wall-off-the-diagonals technique as the difficult-terrain test:
    // forces the only route east straight through the elevated tile.
    const map = emptyMap(10, 10, [
      { x: 6, y: 5, tileId: "grass", elevation: 10 },
      { x: 6, y: 4, tileId: "stone-wall" },
      { x: 6, y: 6, tileId: "stone-wall" },
    ]);
    const reachable = computeReachableCells(map, 5, 5, 10);
    // 10ft budget: climbing onto (6,5) costs 10ft (doubled) exactly —
    // reachable — but any further step would need more than that.
    expect(reachable.has("6,5")).toBe(true);
    expect(reachable.has("7,5")).toBe(false);
  });

  it("does not double-charge a step between two cells at the same nonzero elevation", () => {
    const map = emptyMap(10, 10, [
      { x: 6, y: 5, tileId: "grass", elevation: 10 },
      { x: 7, y: 5, tileId: "grass", elevation: 10 },
    ]);
    const reachable = computeReachableCells(map, 6, 5, 5);
    expect(reachable.has("7,5")).toBe(true);
  });

  it("flying skips the climbing surcharge", () => {
    const map = emptyMap(10, 10, [
      { x: 6, y: 5, tileId: "grass", elevation: 10 },
      { x: 6, y: 4, tileId: "stone-wall" },
      { x: 6, y: 6, tileId: "stone-wall" },
    ]);
    expect(computeReachableCells(map, 5, 5, 5, undefined, false).has("6,5")).toBe(false);
    expect(computeReachableCells(map, 5, 5, 5, undefined, true).has("6,5")).toBe(true);
  });

  it("lets a flying combatant cross a blocksMovement tile stamped with negative elevation, unlike a grounded one", () => {
    const map = emptyMap(10, 10, [
      { x: 6, y: 5, tileId: "chasm", elevation: -20 },
      { x: 6, y: 4, tileId: "stone-wall" },
      { x: 6, y: 6, tileId: "stone-wall" },
    ]);
    expect(computeReachableCells(map, 5, 5, 30, undefined, false).has("6,5")).toBe(false);
    expect(computeReachableCells(map, 5, 5, 30, undefined, true).has("6,5")).toBe(true);
  });

  it("still blocks a flying combatant at an ordinary blocksMovement tile with no elevation stamped", () => {
    const map = emptyMap(10, 10, [{ x: 6, y: 5, tileId: "stone-wall" }]);
    const reachable = computeReachableCells(map, 5, 5, 30, undefined, true);
    expect(reachable.has("6,5")).toBe(false);
  });
});

describe("span layer", () => {
  // The bug this layer exists to fix: a bridge used to overwrite the chasm
  // it crossed, so the chasm stopped existing. Now both placements live in
  // the cell and the bridge is what you walk on.
  const chasmAndBridge = () => emptyMap(10, 10, [
    { x: 6, y: 5, tileId: "chasm", elevation: -20 },
    { x: 6, y: 5, tileId: "bridge", layer: "span" as const },
  ]);

  it("lets a grounded combatant cross a bridge laid over a chasm", () => {
    const reachable = computeReachableCells(chasmAndBridge(), 5, 5, 30);
    expect(reachable.has("6,5")).toBe(true);
    expect(reachable.has("7,5")).toBe(true);
  });

  it("still blocks that same chasm cell once the bridge is taken away", () => {
    const map = emptyMap(10, 10, [{ x: 6, y: 5, tileId: "chasm", elevation: -20 }]);
    const reachable = computeReachableCells(map, 5, 5, 30);
    expect(reachable.has("6,5")).toBe(false);
  });

  it("reads the span's height, not the ground's, for a creature crossing it", () => {
    // Standing on the deck is standing at deck height — the -20 stamped on
    // the chasm below describes the drop, not where the token is.
    expect(elevationAt(chasmAndBridge(), 6, 5)).toBeUndefined();
    expect(elevationAt(emptyMap(10, 10, [
      { x: 6, y: 5, tileId: "chasm", elevation: -20 },
      { x: 6, y: 5, tileId: "bridge", layer: "span", elevation: 15 },
    ]), 6, 5)).toBe(15);
  });

  it("keeps the ground underneath reachable through groundTileAt", () => {
    expect(groundTileAt(chasmAndBridge(), 6, 5)?.tileId).toBe("chasm");
    expect(standingTileAt(chasmAndBridge(), 6, 5)?.tileId).toBe("bridge");
  });

  it("charges the span's difficult terrain, not the ground's, to step onto it", () => {
    // A rope bridge is difficult terrain and so costs a 5ft budget's whole
    // allowance plus some — reachable at 10ft, not at 5 — while the plain
    // grass it crosses would have been a single ordinary step.
    const spanned = emptyMap(10, 10, [
      { x: 6, y: 5, tileId: "grass" },
      { x: 6, y: 5, tileId: "rope-bridge", layer: "span" },
    ]);
    expect(computeReachableCells(spanned, 5, 5, 5).has("6,5")).toBe(false);
    expect(computeReachableCells(spanned, 5, 5, 10).has("6,5")).toBe(true);

    const bare = emptyMap(10, 10, [{ x: 6, y: 5, tileId: "grass" }]);
    expect(computeReachableCells(bare, 5, 5, 5).has("6,5")).toBe(true);
  });
});
