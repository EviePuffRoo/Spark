import { describe, it, expect } from "vitest";
import { battleMapToUvtt, uvttToBattleMapInput, UVTT_FORMAT_VERSION, UVTT_PIXELS_PER_GRID } from "./vttBridge.js";
import type { PlacedTile } from "./types.js";

describe("battleMapToUvtt", () => {
  it("emits a wall polygon for every blocksVision tile, and nothing for plain floor", () => {
    const tiles: PlacedTile[] = [
      { x: 0, y: 0, tileId: "stone-floor" },
      { x: 1, y: 0, tileId: "stone-wall" },
    ];
    const doc = battleMapToUvtt({ width: 5, height: 5, tiles }, "base64image");
    expect(doc.line_of_sight).toHaveLength(1);
    expect(doc.line_of_sight[0]).toEqual([
      { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 },
    ]);
    expect(doc.format).toBe(UVTT_FORMAT_VERSION);
    expect(doc.resolution).toEqual({ map_origin: { x: 0, y: 0 }, map_size: { x: 5, y: 5 }, pixels_per_grid: UVTT_PIXELS_PER_GRID });
    expect(doc.image).toBe("base64image");
  });

  it("emits a portal for door tiles, including the DM-only secret door", () => {
    const tiles: PlacedTile[] = [
      { x: 2, y: 3, tileId: "wooden-door" },
      { x: 4, y: 5, tileId: "secret-door", layer: "gmOnly" },
    ];
    const doc = battleMapToUvtt({ width: 10, height: 10, tiles }, "img");
    expect(doc.portals).toHaveLength(2);
    expect(doc.portals[0].position).toEqual({ x: 2.5, y: 3.5 });
    expect(doc.portals[1].position).toEqual({ x: 4.5, y: 5.5 });
  });

  it("emits a light for tiles with a lightRadius", () => {
    const tiles: PlacedTile[] = [{ x: 3, y: 3, tileId: "torch-sconce" }];
    const doc = battleMapToUvtt({ width: 10, height: 10, tiles }, "img");
    expect(doc.lights).toHaveLength(1);
    expect(doc.lights[0].position).toEqual({ x: 3.5, y: 3.5 });
    expect(doc.lights[0].range).toBe(4);
  });

  it("ignores decor tiles for walls/portals/lights even if the underlying tileId would otherwise qualify", () => {
    // Decor never affects vision/movement per PlacedTile's own contract —
    // a decor-layer stone-wall shouldn't become a wall in the export.
    const tiles: PlacedTile[] = [{ x: 0, y: 0, tileId: "stone-wall", layer: "decor" }];
    const doc = battleMapToUvtt({ width: 5, height: 5, tiles }, "img");
    expect(doc.line_of_sight).toHaveLength(0);
  });
});

describe("uvttToBattleMapInput", () => {
  it("rejects a non-object or a document missing resolution.map_size", () => {
    expect(() => uvttToBattleMapInput(null, "Map")).toThrow();
    expect(() => uvttToBattleMapInput({}, "Map")).toThrow();
    expect(() => uvttToBattleMapInput({ resolution: {} }, "Map")).toThrow();
  });

  it("clamps map dimensions to Spark's max battle map size", () => {
    const doc = { resolution: { map_size: { x: 9999, y: 9999 } } };
    const input = uvttToBattleMapInput(doc, "Huge Map");
    expect(input.width).toBeLessThanOrEqual(40);
    expect(input.height).toBeLessThanOrEqual(30);
    expect(input.name).toBe("Huge Map");
  });

  it("converts a simple wall polyline into stone-wall tiles at the cells it passes through", () => {
    const doc = {
      resolution: { map_size: { x: 10, y: 10 } },
      line_of_sight: [[{ x: 2, y: 2 }, { x: 5, y: 2 }]],
    };
    const input = uvttToBattleMapInput(doc, "Room");
    const wallCells = input.tiles.filter((t) => t.tileId === "stone-wall").map((t) => `${t.x},${t.y}`);
    expect(wallCells).toContain("2,2");
    expect(wallCells).toContain("3,2");
    expect(wallCells).toContain("4,2");
  });

  it("places a wooden-door tile at each portal position, overriding a wall cell there", () => {
    const doc = {
      resolution: { map_size: { x: 10, y: 10 } },
      line_of_sight: [[{ x: 0, y: 3 }, { x: 5, y: 3 }]],
      portals: [{ position: { x: 2.5, y: 3.2 } }],
    };
    const input = uvttToBattleMapInput(doc, "Room");
    const doorTile = input.tiles.find((t) => t.x === 2 && t.y === 3);
    expect(doorTile?.tileId).toBe("wooden-door");
  });

  it("ignores malformed polygons and portals without throwing", () => {
    const doc = {
      resolution: { map_size: { x: 10, y: 10 } },
      line_of_sight: [null, "not an array", [{ x: 1 }]],
      portals: [null, { position: { x: "nope" } }],
    };
    expect(() => uvttToBattleMapInput(doc, "Weird")).not.toThrow();
  });

  it("round-trips a hand-built map's wall structure through export and back through import", () => {
    const tiles: PlacedTile[] = [
      { x: 0, y: 0, tileId: "stone-wall" },
      { x: 1, y: 0, tileId: "stone-wall" },
      { x: 2, y: 0, tileId: "stone-wall" },
      { x: 1, y: 3, tileId: "wooden-door" },
    ];
    const exported = battleMapToUvtt({ width: 8, height: 8, tiles }, "img");
    const reimported = uvttToBattleMapInput(exported, "Round Trip");
    expect(reimported.width).toBe(8);
    expect(reimported.height).toBe(8);
    const wallCells = new Set(reimported.tiles.filter((t) => t.tileId === "stone-wall").map((t) => `${t.x},${t.y}`));
    expect(wallCells.has("0,0")).toBe(true);
    expect(wallCells.has("1,0")).toBe(true);
    expect(wallCells.has("2,0")).toBe(true);
    const door = reimported.tiles.find((t) => t.x === 1 && t.y === 3);
    expect(door?.tileId).toBe("wooden-door");
  });
});
