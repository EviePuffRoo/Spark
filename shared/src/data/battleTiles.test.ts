import { describe, it, expect } from "vitest";
import { BATTLE_TILES, BATTLE_TILE_BY_ID } from "./battleTiles.js";
import type { TilePack } from "../types.js";

const PACKS: TilePack[] = ["dungeon", "wilderness"];

describe("BATTLE_TILES", () => {
  it("has no duplicate ids", () => {
    const ids = BATTLE_TILES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tags every tile with one of the known packs", () => {
    for (const tile of BATTLE_TILES) {
      expect(PACKS).toContain(tile.pack);
    }
  });

  it("gives every pack at least one tile", () => {
    for (const pack of PACKS) {
      expect(BATTLE_TILES.some((t) => t.pack === pack)).toBe(true);
    }
  });

  it("indexes every tile by id in BATTLE_TILE_BY_ID", () => {
    for (const tile of BATTLE_TILES) {
      expect(BATTLE_TILE_BY_ID[tile.id]).toBe(tile);
    }
  });

  it("tags all pre-existing tiles as the dungeon pack", () => {
    const dungeonOnlyIds = ["grass", "stone-wall", "chasm", "lava", "secret-door"];
    for (const id of dungeonOnlyIds) {
      expect(BATTLE_TILE_BY_ID[id]?.pack).toBe("dungeon");
    }
  });

  it("gives the wilderness pack tiles across multiple categories", () => {
    const wildernessCategories = new Set(BATTLE_TILES.filter((t) => t.pack === "wilderness").map((t) => t.category));
    expect(wildernessCategories.size).toBeGreaterThan(1);
  });
});
