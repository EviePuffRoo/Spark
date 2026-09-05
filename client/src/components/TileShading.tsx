import { BATTLE_TILE_BY_ID, buildStandingIndex, type PlacedTile } from "@spark/shared";

// Every tile in the set is a flat 10x10 square, so a painted map renders as
// a grid of evenly-lit stamps with nothing to say where the walls stop and
// the floor starts. This adds the depth cue a hand-drawn battle map gets for
// free: open ground picks up a soft shadow along any edge it shares with
// something tall, so rooms read as carved out rather than tiled in.
//
// It's derived entirely from the tiles already placed — no new art, no extra
// data on the map — and drawn as one pass over the grid above the tiles and
// below anything interactive.
//
// The light is directional, from the north-west. Shading every side of a
// solid tile equally rings an isolated pillar in a dark box, which reads as
// a painted square rather than a shadow; casting to the south-east instead
// gives the whole map one consistent light and lets a pillar throw a real
// drop shadow. The two lit sides keep a faint contact shade so objects
// still feel seated on the floor rather than floating.

const DEPTH = 0.34;       // shadow reach into a cell, as a fraction of the cell
const CONTACT = 0.16;     // reach of the fainter shade on the lit sides
const CORNER = 0.3;
const RIM = 0.17;         // lit edge on a solid tile's exposed north/west faces
const SEAM = 0.055;       // width of the join between two different materials

// "Tall" means it blocks line of sight: walls, pillars, bookshelves, closed
// doors, boulders, trees. A table or a chest blocks movement but you can see
// over it, so it shouldn't cast a wall's shadow.
export function castsShadow(tileId: string | undefined): boolean {
  if (!tileId) return false;
  return !!BATTLE_TILE_BY_ID[tileId]?.blocksVision;
}

export function TileShadingDefs() {
  return (
    <>
      <linearGradient id="tile-shade-n" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.38" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="tile-shade-s" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity="0.15" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="tile-shade-w" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity="0.44" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="tile-shade-e" x1="1" y1="0" x2="0" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity="0.15" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </linearGradient>
      {/* The counterpart to the shadow: with the light in the north-west, the
          exposed north and west faces of a raised mass catch it. A rim there
          plus a shadow falling south-east is what reads as an extruded block
          rather than a flat square of brick. */}
      <linearGradient id="tile-rim-n" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="tile-rim-w" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0.24" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      {/* Fills the notch left at an outside corner, where the two straight
          edges meeting there each stop short of the diagonal. */}
      <radialGradient id="tile-shade-corner" cx="0" cy="0" r="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.34" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </radialGradient>
    </>
  );
}

// Builds the shadow geometry for a grid. Pure, so callers can memoize it on
// the tile list — this runs over every cell and shouldn't repeat per frame.
export function buildTileShading(
  tiles: PlacedTile[],
  width: number,
  height: number,
  cell: number,
) {
  // What casts a shadow is decided by the cell's standing tile — the span
  // if one is there, else the floor — the same tile the movement and sight
  // engines read (see mapCells.ts). A bridge over a chasm shades as a
  // bridge, not as the chasm underneath it.
  const solid = new Set<string>();
  for (const [key, t] of buildStandingIndex(tiles)) {
    if (castsShadow(t.tileId)) solid.add(key);
  }
  const isSolid = (x: number, y: number) => solid.has(`${x},${y}`);

  const d = cell * DEPTH;
  const q = cell * CONTACT;
  const c = cell * CORNER;
  const edges: { key: string; x: number; y: number; w: number; h: number; fill: string }[] = [];
  const rims: { key: string; x: number; y: number; w: number; h: number; fill: string }[] = [];
  const seams: { key: string; x: number; y: number; w: number; h: number }[] = [];

  // What material each cell's ground is, so a boundary between two of them
  // can be found. Restricted to the terrain category on purpose: an altar or
  // a chest is an object standing on ground, not a material, and seaming
  // around one draws a box that makes it look pasted on rather than placed.
  // Where ground meets something solid there's already a rim and a shadow,
  // and a seam on top would double that line.
  //
  // Unlike the shadows above this deliberately reads the floor layer, not
  // the standing tile: a chasm crossed by a bridge is still one continuous
  // chasm, and its seam against the stone beside it belongs at the stone,
  // not broken wherever the deck happens to pass over.
  const groundAt = new Map<string, string>();
  for (const t of tiles) {
    if ((t.layer ?? "floor") !== "floor") continue;
    if (BATTLE_TILE_BY_ID[t.tileId]?.category !== "terrain") continue;
    groundAt.set(`${t.x},${t.y}`, t.tileId);
  }
  const corners: { key: string; cx: number; cy: number; r: number; rot: number }[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x * cell;
      const py = y * cell;

      if (isSolid(x, y)) {
        // A solid tile only shows an edge where the mass actually stops —
        // inside a run of wall the surface is continuous and unlit.
        const r = cell * RIM;
        if (!isSolid(x, y - 1)) rims.push({ key: `rn${x},${y}`, x: px, y: py, w: cell, h: r, fill: "url(#tile-rim-n)" });
        if (!isSolid(x - 1, y)) rims.push({ key: `rw${x},${y}`, x: px, y: py, w: r, h: cell, fill: "url(#tile-rim-w)" });
        continue; // shadow falls on open ground, not on the wall
      }

      const n = isSolid(x, y - 1);
      const s = isSolid(x, y + 1);
      const w = isSolid(x - 1, y);
      const e = isSolid(x + 1, y);

      // Cast from the north-west: a wall above or to the left throws its
      // shadow onto this cell. The other two sides only get a contact shade.
      if (n) edges.push({ key: `n${x},${y}`, x: px, y: py, w: cell, h: d, fill: "url(#tile-shade-n)" });
      if (w) edges.push({ key: `w${x},${y}`, x: px, y: py, w: d, h: cell, fill: "url(#tile-shade-w)" });
      if (s) edges.push({ key: `s${x},${y}`, x: px, y: py + cell - q, w: cell, h: q, fill: "url(#tile-shade-s)" });
      if (e) edges.push({ key: `e${x},${y}`, x: px + cell - q, y: py, w: q, h: cell, fill: "url(#tile-shade-e)" });

      // Only an outside corner needs filling: the diagonal is solid but
      // neither neighbour beside it is, so no straight edge covers it.
      if (!n && !w && isSolid(x - 1, y - 1)) corners.push({ key: `cnw${x},${y}`, cx: px, cy: py, r: c, rot: 0 });
    }
  }
  // Wood butting against stone, or stone against water, meets on a hard
  // pixel edge — the tiles are drawn to fill their cell and know nothing
  // about each other. A thin darker join reads as one material ending and
  // the next beginning, the way a drawn map would ink that boundary.
  const sw = Math.max(1, cell * SEAM);
  for (const [key, tileId] of groundAt) {
    const [x, y] = key.split(",").map(Number);
    const east = groundAt.get(`${x + 1},${y}`);
    const south = groundAt.get(`${x},${y + 1}`);
    if (east && east !== tileId) {
      seams.push({ key: `se${key}`, x: (x + 1) * cell - sw / 2, y: y * cell, w: sw, h: cell });
    }
    if (south && south !== tileId) {
      seams.push({ key: `ss${key}`, x: x * cell, y: (y + 1) * cell - sw / 2, w: cell, h: sw });
    }
  }

  return { edges, corners, rims, seams };
}

export function TileShading({ shading }: { shading: ReturnType<typeof buildTileShading> }) {
  return (
    <g className="tile-shading" pointerEvents="none">
      {shading.rims.map((r) => (
        <rect key={r.key} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
      ))}
      {shading.edges.map((r) => (
        <rect key={r.key} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
      ))}
      {shading.corners.map((c) => (
        <circle key={c.key} cx={c.cx} cy={c.cy} r={c.r} fill="url(#tile-shade-corner)" />
      ))}
      {shading.seams.map((s) => (
        <rect key={s.key} x={s.x} y={s.y} width={s.w} height={s.h} fill="#000" opacity={0.28} />
      ))}
    </g>
  );
}

