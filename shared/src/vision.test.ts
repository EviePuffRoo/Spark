import { describe, it, expect } from "vitest";
import { computeVisibleCells, computeVisionForTokens, extendWithLightSources, DEFAULT_VISION_RADIUS_FEET } from "./vision.js";
import type { BattleMap } from "./types.js";

function emptyMap(width: number, height: number, tiles: BattleMap["tiles"] = []): Pick<BattleMap, "width" | "height" | "tiles"> {
  return { width, height, tiles };
}

describe("computeVisibleCells", () => {
  it("always includes the origin", () => {
    const visible = computeVisibleCells(emptyMap(10, 10), 5, 5, 0);
    expect(visible.has("5,5")).toBe(true);
  });

  it("sees every cell within radius on an open floor", () => {
    const visible = computeVisibleCells(emptyMap(10, 10), 5, 5, 3);
    expect(visible.has("8,5")).toBe(true);
    expect(visible.has("5,8")).toBe(true);
    expect(visible.has("9,5")).toBe(false); // outside the circular radius
  });

  it("can see a wall's near face but not past it", () => {
    const map = emptyMap(10, 10, [{ x: 5, y: 3, tileId: "stone-wall" }]);
    const visible = computeVisibleCells(map, 5, 5, 5);
    expect(visible.has("5,3")).toBe(true); // the wall itself is visible
    expect(visible.has("5,1")).toBe(false); // straight behind it is not
  });

  it("ignores a blocking tile placed on the decor layer", () => {
    // A decor-layer placement is purely cosmetic — even a tile that would
    // normally block sight (stone-wall) must never affect vision when it's
    // layered over a cell rather than being that cell's floor.
    const map = emptyMap(10, 10, [{ x: 5, y: 3, tileId: "stone-wall", layer: "decor" }]);
    const visible = computeVisibleCells(map, 5, 5, 5);
    expect(visible.has("5,1")).toBe(true);
  });

  it("is symmetric: A sees B iff B sees A", () => {
    const map = emptyMap(12, 12, [
      { x: 6, y: 4, tileId: "stone-wall" },
      { x: 7, y: 5, tileId: "stone-wall" },
    ]);
    const fromA = computeVisibleCells(map, 2, 2, 8).has("9,9");
    const fromB = computeVisibleCells(map, 9, 9, 8).has("2,2");
    expect(fromA).toBe(fromB);
  });

  it("does not leak sight through the diagonal gap where two walls meet corner-to-corner", () => {
    // Walls at (1,0) and (0,1), open floor at (1,1) between them — a line
    // from the origin straight through that pinch point must not reach
    // cells beyond it, even though (1,1) itself is open floor.
    const map = emptyMap(10, 10, [
      { x: 1, y: 0, tileId: "stone-wall" },
      { x: 0, y: 1, tileId: "stone-wall" },
    ]);
    const visible = computeVisibleCells(map, 0, 0, 5);
    expect(visible.has("2,2")).toBe(false);
    expect(visible.has("3,3")).toBe(false);
  });

  it("does not leak vision around a fully enclosing wall", () => {
    const tiles: BattleMap["tiles"] = [];
    for (let x = 3; x <= 7; x++) { tiles.push({ x, y: 3, tileId: "stone-wall" }); tiles.push({ x, y: 7, tileId: "stone-wall" }); }
    for (let y = 3; y <= 7; y++) { tiles.push({ x: 3, y, tileId: "stone-wall" }); tiles.push({ x: 7, y, tileId: "stone-wall" }); }
    const map = emptyMap(12, 12, tiles);
    const visible = computeVisibleCells(map, 5, 5, 10);
    expect(visible.has("0,0")).toBe(false);
    expect(visible.has("11,11")).toBe(false);
    expect(visible.has("5,5")).toBe(true);
  });
});

describe("computeVisionForTokens", () => {
  it("uses only playerCharacter tokens, not monsters", () => {
    const map = emptyMap(10, 10);
    const visible = computeVisionForTokens(map, [
      { kind: "monster", gridX: 5, gridY: 5, visionRadiusFeet: undefined },
    ]);
    expect(visible.size).toBe(0);
  });

  it("unions vision across multiple PC tokens", () => {
    const map = emptyMap(20, 20);
    const visible = computeVisionForTokens(map, [
      { kind: "playerCharacter", gridX: 2, gridY: 2, visionRadiusFeet: 10 },
      { kind: "playerCharacter", gridX: 17, gridY: 17, visionRadiusFeet: 10 },
    ]);
    expect(visible.has("2,2")).toBe(true);
    expect(visible.has("17,17")).toBe(true);
  });

  it("skips a PC token with no grid position yet", () => {
    const map = emptyMap(10, 10);
    const visible = computeVisionForTokens(map, [{ kind: "playerCharacter", gridX: undefined, gridY: undefined }]);
    expect(visible.size).toBe(0);
  });

  it("defaults to DEFAULT_VISION_RADIUS_FEET when unset", () => {
    const map = emptyMap(40, 40);
    const withDefault = computeVisionForTokens(map, [{ kind: "playerCharacter", gridX: 20, gridY: 20, visionRadiusFeet: undefined }]);
    const tilesOfDefault = DEFAULT_VISION_RADIUS_FEET / 5;
    expect(withDefault.has(`${20 + tilesOfDefault - 1},20`)).toBe(true);
  });
});

describe("extendWithLightSources", () => {
  it("does not extend from a light source outside the base visible set", () => {
    const map = emptyMap(20, 20, [{ x: 15, y: 15, tileId: "torch-sconce" }]);
    const base = new Set(["5,5"]);
    const extended = extendWithLightSources(map, base);
    expect(extended.has("15,16")).toBe(false);
  });

  it("extends sight past a light source that's already visible", () => {
    const map = emptyMap(20, 20, [{ x: 10, y: 10, tileId: "torch-sconce" }]);
    const base = new Set(["10,10"]); // the torch tile itself is already seen
    const extended = extendWithLightSources(map, base);
    expect(extended.has("13,10")).toBe(true); // torch-sconce has lightRadius: 4
  });

  it("extends sight from a combatant carrying light, once their cell is already visible", () => {
    const map = emptyMap(20, 20);
    const base = new Set(["10,10"]);
    const extended = extendWithLightSources(map, base, [{ gridX: 10, gridY: 10, lightRadiusFeet: 20 }]);
    expect(extended.has("14,10")).toBe(true); // 20ft / 5ft-per-tile = 4 tiles
  });

  it("does not extend from a carried light source outside the base visible set", () => {
    const map = emptyMap(20, 20);
    const base = new Set(["5,5"]);
    const extended = extendWithLightSources(map, base, [{ gridX: 15, gridY: 15, lightRadiusFeet: 20 }]);
    expect(extended.has("15,16")).toBe(false);
  });

  it("ignores a carrier with no lightRadiusFeet or no grid position", () => {
    const map = emptyMap(20, 20);
    const base = new Set(["10,10"]);
    const extended = extendWithLightSources(map, base, [{ gridX: 10, gridY: 10 }, { gridX: undefined, gridY: undefined, lightRadiusFeet: 30 }]);
    expect(extended).toEqual(base);
  });
});
