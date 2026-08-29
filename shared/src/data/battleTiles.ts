import type { TileDef } from "../types.js";

// The complete, curated tile palette every BattleMap is built from — no
// uploads, no per-DM art. Adding a new tile here is the only way the set
// grows, same pattern as BASE_UPGRADES: one static, typed source of truth
// that both the builder's palette and (eventually) the vision/movement
// engine read directly, so a tile's rendered icon and its mechanical rules
// can never drift apart.
export const BATTLE_TILES: TileDef[] = [
  // Terrain
  { id: "grass", name: "Grass", category: "terrain", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "stone-floor", name: "Stone Floor", category: "terrain", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "wooden-floor", name: "Wooden Floor", category: "terrain", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "water", name: "Water", category: "terrain", blocksMovement: false, blocksVision: false, difficultTerrain: true, pack: "dungeon" },
  { id: "rubble", name: "Rubble", category: "terrain", blocksMovement: false, blocksVision: false, difficultTerrain: true, pack: "dungeon" },
  // Stamp a negative PlacedTile.elevation onto a placed chasm to mark it as
  // an open-air drop rather than a solid barrier — a flying combatant can
  // then cross it despite blocksMovement (see gridMovement.ts's
  // computeReachableCells and LiveCombatant.flying).
  { id: "chasm", name: "Chasm", category: "terrain", blocksMovement: true, blocksVision: false, difficultTerrain: false, pack: "dungeon" },

  // Structure
  { id: "stone-wall", name: "Stone Wall", category: "structure", blocksMovement: true, blocksVision: true, difficultTerrain: false, pack: "dungeon" },
  // Closed is the resting state — blocksMovement/blocksVision here
  // describe a shut door. An Encounter can toggle it open per-cell (see
  // EncounterStateInput.openDoorCells); vision.ts/gridMovement.ts's
  // openDoors param overrides these to false for an open door.
  { id: "wooden-door", name: "Wooden Door", category: "structure", blocksMovement: true, blocksVision: true, difficultTerrain: false, isDoor: true, pack: "dungeon" },
  { id: "window", name: "Window", category: "structure", blocksMovement: true, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "pillar", name: "Pillar", category: "structure", blocksMovement: true, blocksVision: true, difficultTerrain: false, pack: "dungeon" },
  { id: "wooden-fence", name: "Wooden Fence", category: "structure", blocksMovement: true, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "torch-sconce", name: "Torch Sconce", category: "structure", blocksMovement: true, blocksVision: false, difficultTerrain: false, lightRadius: 4, pack: "dungeon" },
  { id: "rug", name: "Rug", category: "structure", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "dungeon" },

  // Nature
  { id: "tree", name: "Tree", category: "nature", blocksMovement: true, blocksVision: true, difficultTerrain: false, pack: "dungeon" },
  { id: "dense-brush", name: "Dense Brush", category: "nature", blocksMovement: false, blocksVision: true, difficultTerrain: true, pack: "dungeon" },
  { id: "boulder", name: "Boulder", category: "nature", blocksMovement: true, blocksVision: true, difficultTerrain: false, pack: "dungeon" },

  // Hazard
  { id: "lava", name: "Lava", category: "hazard", blocksMovement: true, blocksVision: false, difficultTerrain: false, hazard: { label: "Lava", damage: 10 }, lightRadius: 3, pack: "dungeon" },
  { id: "spike-trap", name: "Spike Trap", category: "hazard", blocksMovement: false, blocksVision: false, difficultTerrain: false, hazard: { label: "Spike Trap", damage: 5 }, pack: "dungeon" },
  { id: "fire", name: "Fire", category: "hazard", blocksMovement: false, blocksVision: false, difficultTerrain: false, hazard: { label: "Fire", damage: 8 }, lightRadius: 3, pack: "dungeon" },
  { id: "caltrops", name: "Caltrops", category: "hazard", blocksMovement: false, blocksVision: false, difficultTerrain: false, hazard: { label: "Caltrops", damage: 1 }, pack: "dungeon" },
  { id: "poison-gas", name: "Poison Gas", category: "hazard", blocksMovement: false, blocksVision: true, difficultTerrain: false, hazard: { label: "Poison Gas", damage: 3 }, pack: "dungeon" },

  // More terrain
  { id: "sand", name: "Sand", category: "terrain", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "snow", name: "Snow", category: "terrain", blocksMovement: false, blocksVision: false, difficultTerrain: true, pack: "dungeon" },
  { id: "mud", name: "Mud", category: "terrain", blocksMovement: false, blocksVision: false, difficultTerrain: true, pack: "dungeon" },
  { id: "ice", name: "Ice", category: "terrain", blocksMovement: false, blocksVision: false, difficultTerrain: true, pack: "dungeon" },

  // More structure
  { id: "stairs-up", name: "Stairs Up", category: "structure", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "stairs-down", name: "Stairs Down", category: "structure", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "bridge", name: "Bridge", category: "structure", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "table", name: "Table", category: "structure", blocksMovement: true, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "chest", name: "Chest", category: "structure", blocksMovement: true, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "bookshelf", name: "Bookshelf", category: "structure", blocksMovement: true, blocksVision: true, difficultTerrain: false, pack: "dungeon" },
  { id: "altar", name: "Altar", category: "structure", blocksMovement: true, blocksVision: false, difficultTerrain: false, pack: "dungeon" },

  // More nature
  { id: "mushroom-patch", name: "Mushroom Patch", category: "nature", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "brambles", name: "Brambles", category: "nature", blocksMovement: false, blocksVision: false, difficultTerrain: true, pack: "dungeon" },
  { id: "fallen-log", name: "Fallen Log", category: "nature", blocksMovement: true, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "vines", name: "Hanging Vines", category: "nature", blocksMovement: false, blocksVision: true, difficultTerrain: false, pack: "dungeon" },

  // Decor — purely cosmetic, painted on the decor layer over a floor tile.
  // Never consulted by vision.ts/gridMovement.ts (see PlacedTile.layer).
  { id: "bloodstain", name: "Bloodstain", category: "decor", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "moss", name: "Moss", category: "decor", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "banner", name: "Banner", category: "decor", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "bones", name: "Bones", category: "decor", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "scorch-mark", name: "Scorch Mark", category: "decor", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "cracked-tile", name: "Cracked Tile", category: "decor", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "dungeon" },

  // GM Only — markers painted on the gmOnly layer, stripped server-side
  // before ever reaching a non-owner viewer (see PlacedTile.layer). Mark
  // these mechanically inert too, as a second line of defense.
  { id: "secret-door", name: "Secret Door", category: "gmOnly", blocksMovement: true, blocksVision: true, difficultTerrain: false, isDoor: true, pack: "dungeon" },
  { id: "hidden-trap", name: "Hidden Trap", category: "gmOnly", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "ambush-point", name: "Ambush Point", category: "gmOnly", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "dungeon" },
  { id: "treasure-cache", name: "Treasure Cache", category: "gmOnly", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "dungeon" },

  // Wilderness pack — an outdoor complement to the dungeon set above, for
  // maps set in open terrain rather than halls and rooms.
  { id: "tall-grass", name: "Tall Grass", category: "nature", blocksMovement: false, blocksVision: true, difficultTerrain: false, pack: "wilderness" },
  { id: "thicket", name: "Thicket", category: "nature", blocksMovement: true, blocksVision: true, difficultTerrain: false, pack: "wilderness" },
  { id: "fallen-branches", name: "Fallen Branches", category: "nature", blocksMovement: true, blocksVision: false, difficultTerrain: false, pack: "wilderness" },
  { id: "boulder-field", name: "Boulder Field", category: "terrain", blocksMovement: false, blocksVision: false, difficultTerrain: true, pack: "wilderness" },
  // Same negative-elevation convention as chasm above (see gridMovement.ts's
  // computeReachableCells and LiveCombatant.flying).
  { id: "ravine", name: "Ravine", category: "terrain", blocksMovement: true, blocksVision: false, difficultTerrain: false, pack: "wilderness" },
  { id: "rope-bridge", name: "Rope Bridge", category: "structure", blocksMovement: false, blocksVision: false, difficultTerrain: true, pack: "wilderness" },
  { id: "cave-mouth", name: "Cave Mouth", category: "structure", blocksMovement: false, blocksVision: true, difficultTerrain: false, pack: "wilderness" },
  { id: "campfire", name: "Campfire", category: "hazard", blocksMovement: true, blocksVision: false, difficultTerrain: false, hazard: { label: "Campfire", damage: 3 }, lightRadius: 4, pack: "wilderness" },
  { id: "hunting-trap", name: "Hunting Trap", category: "hazard", blocksMovement: false, blocksVision: false, difficultTerrain: false, hazard: { label: "Hunting Trap", damage: 5 }, pack: "wilderness" },
  { id: "wildflowers", name: "Wildflowers", category: "decor", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "wilderness" },
  { id: "game-trail", name: "Game Trail", category: "decor", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "wilderness" },
  // GM Only — same second-line-of-defense guarantee as the dungeon pack's
  // gmOnly markers above (see PlacedTile.layer).
  { id: "animal-den", name: "Animal Den", category: "gmOnly", blocksMovement: false, blocksVision: false, difficultTerrain: false, pack: "wilderness" },
];

export const BATTLE_TILE_BY_ID: Record<string, TileDef> = Object.fromEntries(BATTLE_TILES.map((t) => [t.id, t]));
