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
];

export const BATTLE_TILE_BY_ID: Record<string, TileDef> = Object.fromEntries(BATTLE_TILES.map((t) => [t.id, t]));
