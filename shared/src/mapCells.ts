import type { BattleMap, PlacedTile, TileDef } from "./types.js";
import { BATTLE_TILE_BY_ID } from "./data/battleTiles.js";

// Resolving "what is at this cell" — the one place that answers it.
//
// A cell can hold a tile on each of four layers (see PlacedTile.layer), and
// two of them are mechanical: the floor is the ground, and a span is a
// bridge or rope bridge laid across that ground without replacing it. When
// both are present the span is what a creature is standing on, so the span
// is what movement and sight ask about — you walk on the bridge, not in the
// chasm it crosses.
//
// This used to live as a copied `tileAt` in both gridMovement.ts and
// vision.ts. It's one function now because the span rule has to mean the
// same thing to both: a bridge the movement engine lets you cross but the
// vision engine still treats as an open chasm is exactly the "the server
// and the client disagree about what just happened at the table" class of
// bug that keeping rules in one place is meant to prevent.

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

// Which of a cell's placements its mechanics come from. Stated once, here,
// and used both for a one-off query and for the whole-map index below.
function pickStanding(tiles: Iterable<PlacedTile>): PlacedTile | undefined {
  let ground: PlacedTile | undefined;
  let span: PlacedTile | undefined;
  for (const t of tiles) {
    const layer = t.layer ?? "floor";
    // Later placements win within a layer, so a map hand-edited into
    // holding two floor tiles for one cell resolves the same way every
    // time instead of depending on array order at the call site.
    if (layer === "span") span = t;
    else if (layer === "floor") ground = t;
  }
  return span ?? ground;
}

// The placement a creature in this cell is standing on: the span if there
// is one, otherwise the floor. Undefined for a bare, never-painted cell.
export function standingTileAt(map: Pick<BattleMap, "tiles">, x: number, y: number): PlacedTile | undefined {
  return pickStanding(map.tiles.filter((t) => t.x === x && t.y === y));
}

// The ground itself, ignoring anything spanning over it — what's under the
// bridge. Nothing in the rules engine reads this yet; it's what makes the
// chasm still exist once a bridge crosses it, which is the whole point of
// the span layer, and it's what a renderer draws beneath the deck.
export function groundTileAt(map: Pick<BattleMap, "tiles">, x: number, y: number): PlacedTile | undefined {
  return map.tiles.filter((t) => (t.layer ?? "floor") === "floor" && t.x === x && t.y === y).pop();
}

// Every cell's standing placement, keyed by "x,y".
//
// The raycasts and flood fills below used to scan the whole tile list for
// every cell they touched, which on a full 40x30 map is a 1200-entry scan
// run tens of thousands of times per vision pass — and the server runs a
// vision pass on every encounter fetch. Building this once per call and
// looking cells up in it is the same answer for a fraction of the work.
export function buildStandingIndex(tiles: PlacedTile[]): Map<string, PlacedTile> {
  const byCell = new Map<string, PlacedTile[]>();
  for (const t of tiles) {
    const layer = t.layer ?? "floor";
    if (layer !== "floor" && layer !== "span") continue;
    const key = cellKey(t.x, t.y);
    const existing = byCell.get(key);
    if (existing) existing.push(t);
    else byCell.set(key, [t]);
  }
  const index = new Map<string, PlacedTile>();
  for (const [key, cellTiles] of byCell) {
    const standing = pickStanding(cellTiles);
    if (standing) index.set(key, standing);
  }
  return index;
}

// A cell's tile definition as the rules see it. An open door (its "x,y" key
// present in openDoors) reads as fully passable regardless of its base
// (closed) def — see TileDef.isDoor.
export function standingDefIn(index: Map<string, PlacedTile>, x: number, y: number, openDoors?: Set<string>): TileDef | undefined {
  const placed = index.get(cellKey(x, y));
  if (!placed) return undefined;
  const def = BATTLE_TILE_BY_ID[placed.tileId];
  if (def?.isDoor && openDoors?.has(cellKey(x, y))) {
    return { ...def, blocksMovement: false, blocksVision: false };
  }
  return def;
}

// A cell's authored height in feet, or undefined if the DM never stamped
// one (see PlacedTile.elevation). Reads the standing placement, so a
// bridge stamped +15 puts a creature crossing it at 15 feet even though
// the chasm below is stamped -20.
export function elevationAt(map: Pick<BattleMap, "tiles">, x: number, y: number): number | undefined {
  return standingTileAt(map, x, y)?.elevation;
}
