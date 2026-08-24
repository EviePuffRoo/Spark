import type { BattleMapInput, PlacedTile } from "./types.js";
import { BATTLE_MAP_MAX_WIDTH, BATTLE_MAP_MAX_HEIGHT } from "./types.js";
import { BATTLE_TILE_BY_ID } from "./data/battleTiles.js";

// Bidirectional bridge to third-party VTTs (Foundry, DungeonDraft, DungeonFog,
// Talespire, ...) via the open "Universal VTT" (.dd2vtt / .uvtt) JSON format —
// deliberately a FILE format, not a live API integration. Export writes a
// file the DM downloads and imports into their own tool by hand; import
// reads a file the DM uploads by hand. Spark's server never makes an
// outbound network call to any third party for this, and never receives one:
// the only way data crosses this bridge is a file the DM explicitly saves
// and later explicitly opens elsewhere, the same trust boundary as the
// existing "Export World" backup feature. See client/src/pages/
// MapBuilderPage.tsx for where this is wired to actual downloads/uploads.
//
// Spark's BattleMap is a curated tile grid (every cell is one of a fixed
// set of named tiles — see battleTiles.ts), not a freeform image canvas, so
// this bridge trades on the two things UVTT and a tile grid both agree on:
// wall/vision geometry and grid dimensions. It does not attempt to
// round-trip an arbitrary background image into Spark's tileset, or
// preserve Spark's specific tile identities (a "tree" and a "bookshelf"
// both just become "a wall" on the way out).

export const UVTT_FORMAT_VERSION = 0.3;
export const UVTT_PIXELS_PER_GRID = 70;

export interface UvttPoint {
  x: number;
  y: number;
}

export interface UvttPortal {
  position: UvttPoint;
  bounds: UvttPoint[];
  rotation: number;
  closed: boolean;
  freestanding: boolean;
}

export interface UvttLight {
  position: UvttPoint;
  range: number;
  intensity: number;
  color: string;
  shadows: boolean;
}

export interface UvttDocument {
  format: number;
  resolution: {
    map_origin: UvttPoint;
    map_size: UvttPoint;
    pixels_per_grid: number;
  };
  line_of_sight: UvttPoint[][];
  portals: UvttPortal[];
  environment: { baked_lighting: boolean; ambient_light: string };
  lights: UvttLight[];
  // Bare base64, no data: prefix — callers (the client) supply this since
  // rasterizing the tile grid to an image is a rendering concern, not a
  // data-shape one. Import ignores this field entirely (see module docs).
  image: string;
}

const DOOR_TILE_IDS = new Set(["wooden-door", "secret-door"]);

// A UVTT wall/light/portal is a Spark BattleMap tile if and only if the
// tile actually carries that mechanical property — never inferred from a
// tile's name or category, so a future tile added to battleTiles.ts with
// blocksVision:true automatically shows up as a wall here with no changes
// needed in this file.
export function battleMapToUvtt(
  map: { width: number; height: number; tiles: PlacedTile[] },
  imageBase64: string
): UvttDocument {
  const lineOfSight: UvttPoint[][] = [];
  const portals: UvttPortal[] = [];
  const lights: UvttLight[] = [];

  for (const t of map.tiles) {
    // Decor never affects vision or movement (see PlacedTile's docs in
    // types.ts) — skip it entirely so a decor-layer tile can never become a
    // wall/portal/light just because its tileId would otherwise qualify.
    // gmOnly markers are the DM's own secret annotations and DO count here:
    // export is DM-initiated for the DM's own external tool, exactly like
    // an "Export World" backup already includes everything the owner can see.
    if (t.layer === "decor") continue;
    const def = BATTLE_TILE_BY_ID[t.tileId];
    if (!def) continue;

    if (def.blocksVision) {
      lineOfSight.push([
        { x: t.x, y: t.y },
        { x: t.x + 1, y: t.y },
        { x: t.x + 1, y: t.y + 1 },
        { x: t.x, y: t.y + 1 },
        { x: t.x, y: t.y },
      ]);
    }
    if (DOOR_TILE_IDS.has(t.tileId)) {
      portals.push({
        position: { x: t.x + 0.5, y: t.y + 0.5 },
        bounds: [
          { x: t.x, y: t.y + 0.5 },
          { x: t.x + 1, y: t.y + 0.5 },
        ],
        rotation: 0,
        closed: true,
        freestanding: false,
      });
    }
    if (def.lightRadius) {
      lights.push({
        position: { x: t.x + 0.5, y: t.y + 0.5 },
        range: def.lightRadius,
        intensity: 1,
        color: "ffffffff",
        shadows: true,
      });
    }
  }

  return {
    format: UVTT_FORMAT_VERSION,
    resolution: {
      map_origin: { x: 0, y: 0 },
      map_size: { x: map.width, y: map.height },
      pixels_per_grid: UVTT_PIXELS_PER_GRID,
    },
    line_of_sight: lineOfSight,
    portals,
    environment: { baked_lighting: false, ambient_light: "ffffffff" },
    lights,
    image: imageBase64,
  };
}

// Walks a line segment (in grid-unit coordinates, which is what UVTT's
// line_of_sight points are already expressed in) and calls `mark` for
// every grid cell the segment passes through. Oversampled rather than a
// true supercover/Bresenham traversal — simpler, and precise cell
// adjacency doesn't matter here since the result is a starting layout the
// DM refines by hand in Spark's own tile painter, not a final map.
function markLineCells(x0: number, y0: number, x1: number, y1: number, mark: (gx: number, gy: number) => void): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.max(Math.abs(dx), Math.abs(dy), 0.001);
  const steps = Math.ceil(dist * 4);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    mark(Math.floor(x0 + dx * t), Math.floor(y0 + dy * t));
  }
}

// Caps how many wall cells / points a single import will process, so a
// pathological or malformed file can't hang the tab — this all runs
// client-side in the DM's own browser, but there's no reason to trust an
// uploaded file's internal counts any more than any other user input.
const MAX_IMPORTED_WALL_CELLS = 4000;
const MAX_POLYGON_POINTS = 20000;

export function uvttToBattleMapInput(doc: unknown, name: string): BattleMapInput {
  if (!doc || typeof doc !== "object") {
    throw new Error("Not a valid VTT file — expected a JSON object.");
  }
  const d = doc as Partial<UvttDocument>;
  const size = d.resolution?.map_size;
  if (!size || typeof size.x !== "number" || typeof size.y !== "number" || !(size.x > 0) || !(size.y > 0)) {
    throw new Error("VTT file is missing a valid resolution.map_size.");
  }
  const width = Math.max(1, Math.min(BATTLE_MAP_MAX_WIDTH, Math.round(size.x)));
  const height = Math.max(1, Math.min(BATTLE_MAP_MAX_HEIGHT, Math.round(size.y)));

  const wallCells = new Set<string>();
  const polygons = Array.isArray(d.line_of_sight) ? d.line_of_sight : [];
  let pointsProcessed = 0;
  outer: for (const polygon of polygons) {
    if (!Array.isArray(polygon)) continue;
    for (let i = 0; i < polygon.length - 1; i++) {
      if (pointsProcessed++ > MAX_POLYGON_POINTS) break outer;
      const a = polygon[i];
      const b = polygon[i + 1];
      if (!a || !b || typeof a.x !== "number" || typeof a.y !== "number" || typeof b.x !== "number" || typeof b.y !== "number") continue;
      markLineCells(a.x, a.y, b.x, b.y, (gx, gy) => {
        if (gx >= 0 && gx < width && gy >= 0 && gy < height) wallCells.add(`${gx},${gy}`);
      });
    }
    if (wallCells.size > MAX_IMPORTED_WALL_CELLS) break;
  }

  const tiles: PlacedTile[] = [...wallCells].slice(0, MAX_IMPORTED_WALL_CELLS).map((key) => {
    const [x, y] = key.split(",").map(Number);
    return { x, y, tileId: "stone-wall" };
  });

  const portals = Array.isArray(d.portals) ? d.portals : [];
  for (const portal of portals) {
    const pos = portal?.position;
    if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") continue;
    const gx = Math.max(0, Math.min(width - 1, Math.floor(pos.x)));
    const gy = Math.max(0, Math.min(height - 1, Math.floor(pos.y)));
    const existing = tiles.find((t) => t.x === gx && t.y === gy);
    if (existing) existing.tileId = "wooden-door";
    else tiles.push({ x: gx, y: gy, tileId: "wooden-door" });
  }

  return { name, width, height, tiles };
}
