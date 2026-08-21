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
};

export function BattleTileDefs() {
  return (
    <defs>
      {BATTLE_TILES.map((tile) => (
        <symbol key={tile.id} id={`tile-${tile.id}`} viewBox="0 0 10 10">
          {TILE_SHAPES[tile.id]}
        </symbol>
      ))}
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
