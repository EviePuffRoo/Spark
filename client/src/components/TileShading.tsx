import { BATTLE_TILE_BY_ID, type PlacedTile } from "@spark/shared";

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
  const solid = new Set<string>();
  for (const t of tiles) {
    if ((t.layer ?? "floor") !== "floor") continue;
    if (castsShadow(t.tileId)) solid.add(`${t.x},${t.y}`);
  }
  const isSolid = (x: number, y: number) => solid.has(`${x},${y}`);

  const d = cell * DEPTH;
  const q = cell * CONTACT;
  const c = cell * CORNER;
  const edges: { key: string; x: number; y: number; w: number; h: number; fill: string }[] = [];
  const corners: { key: string; cx: number; cy: number; r: number; rot: number }[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isSolid(x, y)) continue; // shadow falls on open ground, not on the wall
      const px = x * cell;
      const py = y * cell;

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
  return { edges, corners };
}

export function TileShading({ shading }: { shading: ReturnType<typeof buildTileShading> }) {
  return (
    <g className="tile-shading" pointerEvents="none">
      {shading.edges.map((r) => (
        <rect key={r.key} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
      ))}
      {shading.corners.map((c) => (
        <circle key={c.key} cx={c.cx} cy={c.cy} r={c.r} fill="url(#tile-shade-corner)" />
      ))}
    </g>
  );
}

