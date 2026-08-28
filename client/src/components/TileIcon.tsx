import type { ReactNode } from "react";
import { BATTLE_TILES } from "@spark/shared";

// Every tile's visual is a flat background plus one or two accent shapes,
// all within a 0-10 unit square — cheap enough to repeat across a battle
// map's whole grid (up to 40x30 cells) without taxing SVG render time.
// Defined once per tile id so both the palette (TileSwatch, standalone)
// and the painted grid (BattleTileDefs' <symbol>s, referenced via <use>)
// share the exact same art.
const TILE_SHAPES: Record<string, ReactNode> = {
  grass: (
    <>
      <rect width="10" height="10" fill="#4a7c3f" />
      <path d="M2 7l0-2M4 8l0-2.5M6 7.5l0-2M8 8l0-2" stroke="#2f5a28" strokeWidth="0.5" strokeLinecap="round" />
    </>
  ),
  "stone-floor": (
    <>
      <rect width="10" height="10" fill="#8a8a86" />
      <path d="M0 3.5h10M0 7h10M3.5 0v3.5M7 3.5v3.5M3.5 7v3" stroke="#71716c" strokeWidth="0.3" />
    </>
  ),
  "wooden-floor": (
    <>
      <rect width="10" height="10" fill="#9c6b3f" />
      <path d="M0 2.5h10M0 5h10M0 7.5h10" stroke="#7a5230" strokeWidth="0.4" />
    </>
  ),
  water: (
    <>
      <rect width="10" height="10" fill="#3a72a8" />
      <path d="M0 3q1.5 1 3 0t3 0 3 0M0 6.5q1.5 1 3 0t3 0 3 0" stroke="#7fb6dd" strokeWidth="0.5" fill="none" />
    </>
  ),
  rubble: (
    <>
      <rect width="10" height="10" fill="#7a7268" />
      <circle cx="2.5" cy="3" r="1" fill="#5c564d" />
      <circle cx="6.5" cy="4.5" r="1.3" fill="#5c564d" />
      <circle cx="4" cy="7.5" r="0.9" fill="#5c564d" />
    </>
  ),
  chasm: (
    <>
      <rect width="10" height="10" fill="#161616" />
      <path d="M0 0l10 10M10 0L0 10" stroke="#050505" strokeWidth="1.2" />
    </>
  ),
  "stone-wall": (
    <>
      <rect width="10" height="10" fill="#55534d" />
      <path d="M0 2.5h10M0 7.5h10M5 0v2.5M2.5 2.5v5M7.5 2.5v5M5 7.5v2.5" stroke="#3d3b37" strokeWidth="0.5" />
    </>
  ),
  "wooden-door": (
    <>
      <rect width="10" height="10" fill="#6b4423" />
      <rect x="1" y="0.7" width="8" height="8.6" rx="0.5" fill="none" stroke="#4a2d16" strokeWidth="0.5" />
      <circle cx="7.5" cy="5" r="0.6" fill="#e8c574" />
    </>
  ),
  // A door's open art: floor showing through the gap, with the door leaf
  // swung to one side against the frame — same palette as the closed
  // symbol above so the two clearly read as one tile's two states.
  "wooden-door-open": (
    <>
      <rect width="10" height="10" fill="#8a8a86" />
      <rect x="0.6" y="0.7" width="2" height="8.6" rx="0.4" fill="#6b4423" stroke="#4a2d16" strokeWidth="0.4" />
      <circle cx="2.1" cy="5" r="0.4" fill="#e8c574" />
    </>
  ),
  window: (
    <>
      <rect width="10" height="10" fill="#cde8f5" />
      <rect width="10" height="10" fill="none" stroke="#5c4a33" strokeWidth="1.4" />
      <path d="M5 0v10M0 5h10" stroke="#5c4a33" strokeWidth="0.6" />
    </>
  ),
  pillar: (
    <>
      <rect width="10" height="10" fill="#8a8a86" />
      <circle cx="5" cy="5" r="3.2" fill="#a8a8a3" stroke="#5c5c57" strokeWidth="0.5" />
    </>
  ),
  "wooden-fence": (
    <>
      <rect width="10" height="10" fill="#5f8a4a" />
      <path d="M0 4h10M0 6.5h10" stroke="#7a5230" strokeWidth="0.7" />
      <path d="M2 2.5v6M5 2.5v6M8 2.5v6" stroke="#7a5230" strokeWidth="0.8" />
    </>
  ),
  "torch-sconce": (
    <>
      <rect width="10" height="10" fill="#3a352e" />
      <rect x="4" y="6" width="2" height="3" fill="#5c4a33" />
      <path d="M5 2.5c-1 1-1.4 1.9-1.4 2.7a1.4 1.4 0 002.8 0c0-.8-.4-1.7-1.4-2.7z" fill="#f0a83c" />
      <path d="M5 3.6c-.6.7-.8 1.2-.8 1.6a.8.8 0 001.6 0c0-.4-.2-.9-.8-1.6z" fill="#f5d76e" />
    </>
  ),
  rug: (
    <>
      <rect width="10" height="10" fill="#7a2020" />
      <rect x="1" y="1" width="8" height="8" fill="none" stroke="#c9a04a" strokeWidth="0.6" />
      <rect x="2.3" y="2.3" width="5.4" height="5.4" fill="none" stroke="#c9a04a" strokeWidth="0.3" />
    </>
  ),
  tree: (
    <>
      <rect width="10" height="10" fill="#4a7c3f" />
      <rect x="4.3" y="5.5" width="1.4" height="4" fill="#5c4023" />
      <circle cx="5" cy="4" r="3.4" fill="#2f6b30" />
    </>
  ),
  "dense-brush": (
    <>
      <rect width="10" height="10" fill="#3d5c30" />
      <circle cx="3" cy="4" r="1.8" fill="#568040" />
      <circle cx="6.5" cy="3" r="1.6" fill="#568040" />
      <circle cx="5" cy="6.5" r="2" fill="#568040" />
    </>
  ),
  boulder: (
    <>
      <rect width="10" height="10" fill="#6a6a63" />
      <path d="M2 7c-.7-1.7-.4-3.4 1-4.4C4.2 1.7 6.4 1.6 7.6 3c1.1 1.2 1.2 3 .3 4.3-1 1.5-4.6 1.6-5.9-.3z" fill="#87877d" stroke="#4f4f49" strokeWidth="0.3" />
    </>
  ),
  lava: (
    <>
      <rect width="10" height="10" fill="#c1440e" />
      <path d="M1 5q1.5-2 3 0t3-1 2 1" stroke="#f5a742" strokeWidth="0.6" fill="none" />
      <circle cx="7" cy="7" r="0.7" fill="#f5d76e" />
      <circle cx="3" cy="7.5" r="0.5" fill="#f5d76e" />
    </>
  ),
  "spike-trap": (
    <>
      <rect width="10" height="10" fill="#8a8a86" />
      <path d="M2 8l1-4 1 4M5 8l1-4 1 4M8 8V4" stroke="#3d3b37" strokeWidth="0.6" fill="none" strokeLinejoin="round" />
    </>
  ),
  fire: (
    <>
      <rect width="10" height="10" fill="#2a1a12" />
      <path d="M5 1.5c-1.4 1.6-2 2.9-2 4a2 2 0 004 0c0-1.1-.6-2.4-2-4z" fill="#e8631c" />
      <path d="M5 3.5c-.8 1-1.1 1.7-1.1 2.3a1.1 1.1 0 002.2 0c0-.6-.3-1.3-1.1-2.3z" fill="#f5d76e" />
    </>
  ),
  caltrops: (
    <>
      <rect width="10" height="10" fill="#5c5650" />
      <path d="M3 7l0-4.5M2 3.5l1-1.2 1 1.2M6.5 7.5l0-4.5M5.5 4l1-1.2 1 1.2" stroke="#c9c2b4" strokeWidth="0.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  "poison-gas": (
    <>
      <rect width="10" height="10" fill="#4a5c30" />
      <circle cx="3.5" cy="4" r="2.2" fill="#7ea340" opacity="0.8" />
      <circle cx="6.3" cy="5.5" r="2.4" fill="#8fbf4a" opacity="0.7" />
      <circle cx="5" cy="3" r="1.8" fill="#a3d456" opacity="0.6" />
    </>
  ),
  sand: (
    <>
      <rect width="10" height="10" fill="#d9c384" />
      <circle cx="2.5" cy="3" r="0.4" fill="#c2a960" />
      <circle cx="6" cy="2.5" r="0.35" fill="#c2a960" />
      <circle cx="4.5" cy="6" r="0.4" fill="#c2a960" />
      <circle cx="7.5" cy="6.5" r="0.35" fill="#c2a960" />
      <circle cx="2" cy="7.5" r="0.3" fill="#c2a960" />
    </>
  ),
  snow: (
    <>
      <rect width="10" height="10" fill="#e8eef2" />
      <path d="M2.5 2.5v3M1 4h3M6.5 5.5v3M5 7h3M8 2v2.5M6.8 3.2h2.4" stroke="#b8ccd6" strokeWidth="0.4" strokeLinecap="round" />
    </>
  ),
  mud: (
    <>
      <rect width="10" height="10" fill="#5c4530" />
      <path d="M1.5 3.5q1.5-1 3 0t3-0.5" stroke="#3d2e1f" strokeWidth="0.6" fill="none" />
      <path d="M1 6.5q1.5-1 3 0t3-0.5 2 0.3" stroke="#3d2e1f" strokeWidth="0.6" fill="none" />
    </>
  ),
  ice: (
    <>
      <rect width="10" height="10" fill="#a8d8e8" />
      <path d="M2 1.5L4 5 1 6.5M8 2L6 5.5l3 1.5M4.5 9L5 6l3 2" stroke="#d6f0f8" strokeWidth="0.4" fill="none" />
    </>
  ),
  "stairs-up": (
    <>
      <rect width="10" height="10" fill="#8a8a86" />
      <rect x="1" y="7" width="8" height="1.5" fill="#5c5c57" />
      <rect x="2" y="5" width="6" height="1.5" fill="#6c6c67" />
      <rect x="3" y="3" width="4" height="1.5" fill="#7c7c77" />
      <rect x="4" y="1" width="2" height="1.5" fill="#8c8c87" />
    </>
  ),
  "stairs-down": (
    <>
      <rect width="10" height="10" fill="#8a8a86" />
      <rect x="4" y="1" width="2" height="1.5" fill="#5c5c57" />
      <rect x="3" y="3" width="4" height="1.5" fill="#6c6c67" />
      <rect x="2" y="5" width="6" height="1.5" fill="#7c7c77" />
      <rect x="1" y="7" width="8" height="1.5" fill="#8c8c87" />
    </>
  ),
  bridge: (
    <>
      <rect width="10" height="10" fill="#8a6a40" />
      <path d="M0 4.5h10M0 6h10" stroke="#6b4f2c" strokeWidth="0.6" />
      <path d="M1 2v2.5M3.5 1.7v2.8M6.5 1.7v2.8M9 2v2.5" stroke="#5c4023" strokeWidth="0.5" />
    </>
  ),
  table: (
    <>
      <rect width="10" height="10" fill="#8a8a86" />
      <rect x="1" y="2.5" width="8" height="4" rx="0.4" fill="#8a5a2f" stroke="#5c3a1c" strokeWidth="0.4" />
      <rect x="1.5" y="6.5" width="0.8" height="2" fill="#5c3a1c" />
      <rect x="7.7" y="6.5" width="0.8" height="2" fill="#5c3a1c" />
    </>
  ),
  chest: (
    <>
      <rect width="10" height="10" fill="#8a8a86" />
      <rect x="2" y="4.5" width="6" height="3.5" rx="0.4" fill="#7a4f26" stroke="#4a2f16" strokeWidth="0.4" />
      <path d="M2 4.5a3 2 0 016 0" fill="none" stroke="#4a2f16" strokeWidth="0.4" />
      <circle cx="5" cy="5.7" r="0.5" fill="#e8c574" />
    </>
  ),
  bookshelf: (
    <>
      <rect width="10" height="10" fill="#5c4023" />
      <rect x="0.8" y="0.8" width="8.4" height="8.4" fill="none" stroke="#3d2a17" strokeWidth="0.6" />
      <rect x="1.5" y="1.5" width="1.2" height="6.8" fill="#a8442f" />
      <rect x="3" y="1.5" width="1.2" height="6.8" fill="#3a6b4a" />
      <rect x="4.5" y="1.5" width="1.2" height="6.8" fill="#4a5a8a" />
      <rect x="6" y="1.5" width="1.2" height="6.8" fill="#8a6a2f" />
      <rect x="7.5" y="1.5" width="1" height="6.8" fill="#7a3a4a" />
    </>
  ),
  altar: (
    <>
      <rect width="10" height="10" fill="#8a8a86" />
      <rect x="1.5" y="6" width="7" height="1.5" fill="#5c5c57" />
      <rect x="2.5" y="2" width="5" height="4" fill="#a8a8a3" stroke="#5c5c57" strokeWidth="0.4" />
      <circle cx="5" cy="4" r="0.8" fill="#e8c574" />
    </>
  ),
  "mushroom-patch": (
    <>
      <rect width="10" height="10" fill="#3d5c30" />
      <path d="M2.5 6.5V5a1.3 1.3 0 012.6 0v1.5" fill="#c9788a" stroke="#8a4a5c" strokeWidth="0.3" />
      <path d="M5.5 7V6a1 1 0 012 0v1" fill="#d68a9a" stroke="#8a4a5c" strokeWidth="0.3" />
      <rect x="2.9" y="6.5" width="0.4" height="1" fill="#e8dcc8" />
      <rect x="6.1" y="7" width="0.4" height="0.8" fill="#e8dcc8" />
    </>
  ),
  brambles: (
    <>
      <rect width="10" height="10" fill="#4a5c2f" />
      <path d="M1.5 8.5c1-4 3-6.5 5-7M2.5 8c.6-3.5 2.4-5.8 4.5-6.8M5.5 8.5c1.5-3 3-5 3-6.5" stroke="#2f3a1c" strokeWidth="0.4" fill="none" strokeLinecap="round" />
      <path d="M3 5l-.6-.6M4 3.5l-.6-.6M5.5 2.5l-.6-.6" stroke="#2f3a1c" strokeWidth="0.3" strokeLinecap="round" />
    </>
  ),
  "fallen-log": (
    <>
      <rect width="10" height="10" fill="#3d5c30" />
      <rect x="0.5" y="4" width="9" height="2.2" rx="1.1" fill="#6b4a2c" stroke="#4a301b" strokeWidth="0.4" />
      <ellipse cx="1.4" cy="5.1" rx="0.9" ry="1.1" fill="#8a6a44" stroke="#4a301b" strokeWidth="0.3" />
      <path d="M3 4.3v2.2M5 4.1v2.4M7 4.3v2.2" stroke="#4a301b" strokeWidth="0.25" />
    </>
  ),
  vines: (
    <>
      <rect width="10" height="10" fill="#2f4a24" />
      <path d="M2 0v10M5 0v6q0 2 2 2M8 0v3q0 2-1.5 2" stroke="#4a7c3f" strokeWidth="0.6" fill="none" />
      <circle cx="2" cy="3" r="0.5" fill="#5c9448" />
      <circle cx="6.8" cy="6" r="0.5" fill="#5c9448" />
      <circle cx="5" cy="7.5" r="0.45" fill="#5c9448" />
    </>
  ),
  bloodstain: (
    <>
      <ellipse cx="5" cy="5.5" rx="2.6" ry="2" fill="#7a1d1d" opacity="0.75" />
      <ellipse cx="7" cy="3.5" rx="0.9" ry="0.7" fill="#7a1d1d" opacity="0.6" />
      <ellipse cx="2.8" cy="7" rx="0.7" ry="0.5" fill="#7a1d1d" opacity="0.5" />
    </>
  ),
  moss: (
    <>
      <circle cx="3" cy="4" r="1.6" fill="#4a7c3f" opacity="0.7" />
      <circle cx="6.5" cy="5.5" r="1.9" fill="#3d6b34" opacity="0.65" />
      <circle cx="5" cy="7.5" r="1.2" fill="#568040" opacity="0.6" />
    </>
  ),
  banner: (
    <>
      <rect x="4.3" y="0" width="0.8" height="10" fill="#5c4a33" />
      <path d="M5 1h3v6l-1.5-1L5 7z" fill="#7a2020" stroke="#4a1414" strokeWidth="0.3" />
    </>
  ),
  bones: (
    <>
      <path d="M2 6.5l3-3M1.5 5l1-1.5-1-1.5M2.5 8l1.5-1-1.5-1M8 3.5L5 6.5M8.5 5l-1 1.5 1 1.5M7.5 2l-1.5 1 1.5 1" stroke="#e8e2d0" strokeWidth="0.9" fill="none" strokeLinecap="round" />
    </>
  ),
  "scorch-mark": (
    <>
      <ellipse cx="5" cy="5.5" rx="3" ry="2.2" fill="#1a1512" opacity="0.7" />
      <path d="M3 5l1.5-2M5 6l1-2.5M6.8 5.5l1-1.8" stroke="#3a1a10" strokeWidth="0.4" opacity="0.6" />
    </>
  ),
  "cracked-tile": (
    <>
      <path d="M2 1l1.5 3-1 2 2 1-.5 2.5M6 0.5l-.5 3 2 1-1 2 1.5 2" stroke="#3a3a35" strokeWidth="0.5" fill="none" strokeLinecap="round" />
    </>
  ),

  // GM Only — transparent background like decor, but a dashed violet
  // outline sets them apart at a glance as DM-eyes-only markers. Only ever
  // rendered for the map's owner (see PlacedTile.layer / toBattleMapDTO).
  "secret-door": (
    <>
      <rect x="1.2" y="0.8" width="7.6" height="8.4" rx="0.4" fill="none" stroke="#8a4fd6" strokeWidth="0.6" strokeDasharray="1.2 0.8" />
      <circle cx="6.5" cy="5" r="0.5" fill="#8a4fd6" />
    </>
  ),
  "hidden-trap": (
    <>
      <path d="M5 1.2l3.6 6.8H1.4z" fill="none" stroke="#8a4fd6" strokeWidth="0.6" strokeDasharray="1 0.8" strokeLinejoin="round" />
      <rect x="4.6" y="3.6" width="0.8" height="2.6" fill="#8a4fd6" />
      <rect x="4.6" y="6.8" width="0.8" height="0.8" fill="#8a4fd6" />
    </>
  ),
  "ambush-point": (
    <>
      <circle cx="5" cy="5" r="3.6" fill="none" stroke="#8a4fd6" strokeWidth="0.6" strokeDasharray="1 0.8" />
      <path d="M3 3l4 4M7 3l-4 4" stroke="#8a4fd6" strokeWidth="0.6" strokeLinecap="round" />
    </>
  ),
  "treasure-cache": (
    <>
      <rect x="1.5" y="4" width="7" height="4.2" rx="0.4" fill="none" stroke="#8a4fd6" strokeWidth="0.6" strokeDasharray="1 0.8" />
      <path d="M1.5 4a3.5 2 0 017 0" fill="none" stroke="#8a4fd6" strokeWidth="0.6" strokeDasharray="1 0.8" />
      <circle cx="5" cy="5.4" r="0.55" fill="#8a4fd6" />
    </>
  ),
};

export function BattleTileDefs() {
  return (
    <defs>
      {BATTLE_TILES.map((tile) => (
        <symbol key={tile.id} id={`tile-${tile.id}`} viewBox="0 0 10 10">
          {TILE_SHAPES[tile.id]}
        </symbol>
      ))}
      {/* Not a real placeable tile — GridMap swaps to this symbol id for a
          door currently toggled open (see Encounter.openDoorCells). Only
          wooden-door needs one: a secret-door is always placed on the
          gmOnly layer (see MapBuilderPage's layerForTile), which the
          door-toggle system never reads in the first place. */}
      <symbol id="tile-wooden-door-open" viewBox="0 0 10 10">
        {TILE_SHAPES["wooden-door-open"]}
      </symbol>
    </defs>
  );
}

export function TileSwatch({ tileId, size = 28 }: { tileId: string; size?: number }) {
  return (
    <svg viewBox="0 0 10 10" width={size} height={size} className="tile-swatch">
      {TILE_SHAPES[tileId]}
    </svg>
  );
}
