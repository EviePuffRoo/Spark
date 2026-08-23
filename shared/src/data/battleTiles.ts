import type { TileDef } from "../types.js";

// The complete, curated tile palette every BattleMap is built from — no
// uploads, no per-DM art. Adding a new tile here is the only way the set
// grows, same pattern as BASE_UPGRADES: one static, typed source of truth
// that both the builder's palette and (eventually) the vision/movement
// engine read directly, so a tile's rendered icon and its mechanical rules
// can never drift apart.
export const BATTLE_TILES: TileDef[] = [
  // Terrain
  { id: "grass", name: "Grass", category: "terrain", blocksMovement: false, blocksVision: false, difficultTerrain: false },
  { id: "stone-floor", name: "Stone Floor", category: "terrain", blocksMovement: false, blocksVision: false, difficultTerrain: false },
  { id: "wooden-floor", name: "Wooden Floor", category: "terrain", blocksMovement: false, blocksVision: false, difficultTerrain: false },
  { id: "water", name: "Water", category: "terrain", blocksMovement: false, blocksVision: false, difficultTerrain: true },
  { id: "rubble", name: "Rubble", category: "terrain", blocksMovement: false, blocksVision: false, difficultTerrain: true },
  { id: "chasm", name: "Chasm", category: "terrain", blocksMovement: true, blocksVision: false, difficultTerrain: false },

  // Structure
  { id: "stone-wall", name: "Stone Wall", category: "structure", blocksMovement: true, blocksVision: true, difficultTerrain: false },
  { id: "wooden-door", name: "Wooden Door", category: "structure", blocksMovement: false, blocksVision: false, difficultTerrain: false },
  { id: "window", name: "Window", category: "structure", blocksMovement: true, blocksVision: false, difficultTerrain: false },
  { id: "pillar", name: "Pillar", category: "structure", blocksMovement: true, blocksVision: true, difficultTerrain: false },
  { id: "wooden-fence", name: "Wooden Fence", category: "structure", blocksMovement: true, blocksVision: false, difficultTerrain: false },
  { id: "torch-sconce", name: "Torch Sconce", category: "structure", blocksMovement: true, blocksVision: false, difficultTerrain: false, lightRadius: 4 },
  { id: "rug", name: "Rug", category: "structure", blocksMovement: false, blocksVision: false, difficultTerrain: false },

  // Nature
  { id: "tree", name: "Tree", category: "nature", blocksMovement: true, blocksVision: true, difficultTerrain: false },
  { id: "dense-brush", name: "Dense Brush", category: "nature", blocksMovement: false, blocksVision: true, difficultTerrain: true },
  { id: "boulder", name: "Boulder", category: "nature", blocksMovement: true, blocksVision: true, difficultTerrain: false },

  // Hazard
  { id: "lava", name: "Lava", category: "hazard", blocksMovement: true, blocksVision: false, difficultTerrain: false, hazard: { label: "Lava", damage: 10 }, lightRadius: 3 },
  { id: "spike-trap", name: "Spike Trap", category: "hazard", blocksMovement: false, blocksVision: false, difficultTerrain: false, hazard: { label: "Spike Trap", damage: 5 } },
  { id: "fire", name: "Fire", category: "hazard", blocksMovement: false, blocksVision: false, difficultTerrain: false, hazard: { label: "Fire", damage: 8 }, lightRadius: 3 },
  { id: "caltrops", name: "Caltrops", category: "hazard", blocksMovement: false, blocksVision: false, difficultTerrain: false, hazard: { label: "Caltrops", damage: 1 } },
  { id: "poison-gas", name: "Poison Gas", category: "hazard", blocksMovement: false, blocksVision: true, difficultTerrain: false, hazard: { label: "Poison Gas", damage: 3 } },

  // More terrain
  { id: "sand", name: "Sand", category: "terrain", blocksMovement: false, blocksVision: false, difficultTerrain: false },
  { id: "snow", name: "Snow", category: "terrain", blocksMovement: false, blocksVision: false, difficultTerrain: true },
  { id: "mud", name: "Mud", category: "terrain", blocksMovement: false, blocksVision: false, difficultTerrain: true },
  { id: "ice", name: "Ice", category: "terrain", blocksMovement: false, blocksVision: false, difficultTerrain: true },

  // More structure
  { id: "stairs-up", name: "Stairs Up", category: "structure", blocksMovement: false, blocksVision: false, difficultTerrain: false },
  { id: "stairs-down", name: "Stairs Down", category: "structure", blocksMovement: false, blocksVision: false, difficultTerrain: false },
  { id: "bridge", name: "Bridge", category: "structure", blocksMovement: false, blocksVision: false, difficultTerrain: false },
  { id: "table", name: "Table", category: "structure", blocksMovement: true, blocksVision: false, difficultTerrain: false },
  { id: "chest", name: "Chest", category: "structure", blocksMovement: true, blocksVision: false, difficultTerrain: false },
  { id: "bookshelf", name: "Bookshelf", category: "structure", blocksMovement: true, blocksVision: true, difficultTerrain: false },
  { id: "altar", name: "Altar", category: "structure", blocksMovement: true, blocksVision: false, difficultTerrain: false },

  // More nature
  { id: "mushroom-patch", name: "Mushroom Patch", category: "nature", blocksMovement: false, blocksVision: false, difficultTerrain: false },
  { id: "brambles", name: "Brambles", category: "nature", blocksMovement: false, blocksVision: false, difficultTerrain: true },
  { id: "fallen-log", name: "Fallen Log", category: "nature", blocksMovement: true, blocksVision: false, difficultTerrain: false },
  { id: "vines", name: "Hanging Vines", category: "nature", blocksMovement: false, blocksVision: true, difficultTerrain: false },

  // Decor — purely cosmetic, painted on the decor layer over a floor tile.
  // Never consulted by vision.ts/gridMovement.ts (see PlacedTile.layer).
  { id: "bloodstain", name: "Bloodstain", category: "decor", blocksMovement: false, blocksVision: false, difficultTerrain: false },
  { id: "moss", name: "Moss", category: "decor", blocksMovement: false, blocksVision: false, difficultTerrain: false },
  { id: "banner", name: "Banner", category: "decor", blocksMovement: false, blocksVision: false, difficultTerrain: false },
  { id: "bones", name: "Bones", category: "decor", blocksMovement: false, blocksVision: false, difficultTerrain: false },
  { id: "scorch-mark", name: "Scorch Mark", category: "decor", blocksMovement: false, blocksVision: false, difficultTerrain: false },
  { id: "cracked-tile", name: "Cracked Tile", category: "decor", blocksMovement: false, blocksVision: false, difficultTerrain: false },

  // GM Only — markers painted on the gmOnly layer, stripped server-side
  // before ever reaching a non-owner viewer (see PlacedTile.layer). Mark
  // these mechanically inert too, as a second line of defense.
  { id: "secret-door", name: "Secret Door", category: "gmOnly", blocksMovement: false, blocksVision: false, difficultTerrain: false },
  { id: "hidden-trap", name: "Hidden Trap", category: "gmOnly", blocksMovement: false, blocksVision: false, difficultTerrain: false },
  { id: "ambush-point", name: "Ambush Point", category: "gmOnly", blocksMovement: false, blocksVision: false, difficultTerrain: false },
  { id: "treasure-cache", name: "Treasure Cache", category: "gmOnly", blocksMovement: false, blocksVision: false, difficultTerrain: false },
];

export const BATTLE_TILE_BY_ID: Record<string, TileDef> = Object.fromEntries(BATTLE_TILES.map((t) => [t.id, t]));
