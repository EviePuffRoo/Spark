import type { MapEdge } from "@spark/shared";

export interface GridExit {
  toRoomId: string;
  toRoomName: string;
  label?: string;
  mapEdge: MapEdge;
}

// Depth of the clickable band, as a fraction of a cell. Deep enough to be an
// easy target at the table, shallow enough not to cover the tiles behind it.
const BAND = 0.7;

// Travel between dungeon rooms used to live only in the zone view: select the
// zone an exit belongs to, press Move Party. A table running the fight on the
// battle grid had to leave the grid to walk next door.
//
// These are the same exits, offered along the edge of the map they lead off
// of — walk to the border, click it, and the room the party is standing in
// changes. It reuses the existing room loader wholesale, so everything that
// already happens on a room change (the next room's zones and battle map
// loading, this room's cleared/alerted state and disarmed traps being
// remembered) happens here too.
export function GridMapExits({
  exits, width, height, cell, onTravel,
}: {
  exits: GridExit[];
  width: number;
  height: number;
  cell: number;
  onTravel: (toRoomId: string) => void;
}) {
  if (!exits.length) return null;
  const w = width * cell;
  const h = height * cell;
  const d = cell * BAND;

  function geometry(edge: MapEdge) {
    switch (edge) {
      case "north": return { x: 0, y: 0, width: w, height: d, tx: w / 2, ty: d * 0.68 };
      case "south": return { x: 0, y: h - d, width: w, height: d, tx: w / 2, ty: h - d * 0.3 };
      case "west": return { x: 0, y: 0, width: d, height: h, tx: d / 2, ty: h / 2 };
      case "east": return { x: w - d, y: 0, width: d, height: h, tx: w - d / 2, ty: h / 2 };
    }
  }

  return (
    <g className="grid-map-exits">
      {exits.map((exit) => {
        const g = geometry(exit.mapEdge);
        const text = `${exit.label || "To"} ${exit.toRoomName}`;
        // Vertical edges read bottom-to-top so the label runs along the band
        // rather than spilling across the map.
        const vertical = exit.mapEdge === "east" || exit.mapEdge === "west";
        return (
          <g
            key={`${exit.mapEdge}-${exit.toRoomId}`}
            className={`grid-map-exit grid-map-exit-${exit.mapEdge}`}
            onClick={() => onTravel(exit.toRoomId)}
            role="button"
            tabIndex={0}
            aria-label={`Travel to ${exit.toRoomName}`}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTravel(exit.toRoomId); } }}
          >
            <rect x={g.x} y={g.y} width={g.width} height={g.height} />
            <text
              x={g.tx}
              y={g.ty}
              textAnchor="middle"
              transform={vertical ? `rotate(${exit.mapEdge === "west" ? -90 : 90} ${g.tx} ${g.ty})` : undefined}
            >
              {text}
            </text>
          </g>
        );
      })}
    </g>
  );
}
