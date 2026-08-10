import { useEffect, useRef, useState } from "react";
import type { Dungeon, DungeonRoom, DungeonRoomRect } from "@spark/shared";
import { corridorPath } from "@spark/shared";

const PADDING = 60;
const FALLBACK_VIEWBOX = "0 0 720 480";

function corridorSvgPath(a: DungeonRoomRect, b: DungeonRoomRect): string {
  const points = corridorPath(a, b);
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

export function DungeonMapView({
  dungeon, canEdit, onUpdateRoomRect, onAutoArrange,
}: {
  dungeon: Dungeon;
  canEdit: boolean;
  onUpdateRoomRect: (roomId: string, rect: DungeonRoomRect) => void;
  onAutoArrange?: () => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origin: DungeonRoomRect; moved: boolean } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const placedRooms = dungeon.rooms.filter((r): r is DungeonRoom & { rect: DungeonRoomRect } => !!r.rect);
  const unplacedRooms = dungeon.rooms.filter((r) => !r.rect);

  // Computed only when switching dungeons or when the placed-room count
  // changes (e.g. after Auto-Arrange) — not on every rect x/y change, so
  // an in-progress drag doesn't shift the SVG's own coordinate system out
  // from under the pointer (viewBox affects getScreenCTM, which the drag
  // math depends on for every pointermove).
  const [viewBox, setViewBox] = useState(FALLBACK_VIEWBOX);
  useEffect(() => {
    if (placedRooms.length === 0) return;
    const minX = Math.min(...placedRooms.map((r) => r.rect.x)) - PADDING;
    const minY = Math.min(...placedRooms.map((r) => r.rect.y)) - PADDING;
    const maxX = Math.max(...placedRooms.map((r) => r.rect.x + r.rect.width)) + PADDING;
    const maxY = Math.max(...placedRooms.map((r) => r.rect.y + r.rect.height)) + PADDING;
    setViewBox(`${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dungeon.id, placedRooms.length]);

  function toLocalDelta(clientX: number, clientY: number, startX: number, startY: number) {
    const svg = svgRef.current;
    if (!svg) return { dx: 0, dy: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { dx: 0, dy: 0 };
    const inverse = ctm.inverse();
    const p1 = svg.createSVGPoint();
    p1.x = startX; p1.y = startY;
    const p2 = svg.createSVGPoint();
    p2.x = clientX; p2.y = clientY;
    const local1 = p1.matrixTransform(inverse);
    const local2 = p2.matrixTransform(inverse);
    const k = transformRef.current.k;
    return { dx: (local2.x - local1.x) / k, dy: (local2.y - local1.y) / k };
  }

  function handleRoomPointerDown(e: React.PointerEvent<SVGGElement>, room: DungeonRoom & { rect: DungeonRoomRect }) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: room.id, startX: e.clientX, startY: e.clientY, origin: room.rect, moved: false };
  }

  function handleRoomPointerMove(e: React.PointerEvent<SVGGElement>, room: DungeonRoom & { rect: DungeonRoomRect }) {
    if (!canEdit) return;
    const drag = dragRef.current;
    if (!drag || drag.id !== room.id) return;
    if (Math.abs(e.clientX - drag.startX) > 4 || Math.abs(e.clientY - drag.startY) > 4) drag.moved = true;
    const { dx, dy } = toLocalDelta(e.clientX, e.clientY, drag.startX, drag.startY);
    onUpdateRoomRect(room.id, { ...drag.origin, x: drag.origin.x + dx, y: drag.origin.y + dy });
  }

  function handleRoomPointerUp(_e: React.PointerEvent<SVGGElement>, room: DungeonRoom & { rect: DungeonRoomRect }) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && drag.id === room.id && !drag.moved) {
      setSelectedRoomId(room.id);
    }
  }

  function handleBackgroundPointerDown(e: React.PointerEvent<SVGRectElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    panRef.current = { startX: e.clientX, startY: e.clientY, originX: transform.x, originY: transform.y };
  }

  function handleBackgroundPointerMove(e: React.PointerEvent<SVGRectElement>) {
    const pan = panRef.current;
    if (!pan) return;
    setTransform((t) => ({ ...t, x: pan.originX + (e.clientX - pan.startX), y: pan.originY + (e.clientY - pan.startY) }));
  }

  function handleBackgroundPointerUp() {
    panRef.current = null;
  }

  function handleWheel(e: React.WheelEvent<SVGSVGElement>) {
    const delta = -e.deltaY * 0.001;
    setTransform((t) => ({ ...t, k: Math.min(2.5, Math.max(0.3, t.k * (1 + delta))) }));
  }

  const roomById = new Map(dungeon.rooms.map((r) => [r.id, r]));
  const selectedRoom = dungeon.rooms.find((r) => r.id === selectedRoomId) ?? null;

  const corridors = placedRooms.flatMap((room) =>
    room.exits
      .filter((exit) => room.id < exit.toRoomId)
      .map((exit) => {
        const other = roomById.get(exit.toRoomId);
        if (!other?.rect) return null;
        return { key: `${room.id}-${exit.toRoomId}`, d: corridorSvgPath(room.rect, other.rect) };
      })
      .filter((c): c is { key: string; d: string } => c !== null),
  );

  return (
    <div className="dungeon-map">
      {unplacedRooms.length > 0 && (
        <div className="dungeon-unplaced-banner">
          <span>{unplacedRooms.length} room{unplacedRooms.length === 1 ? "" : "s"} aren't placed yet.</span>
          {canEdit && onAutoArrange && <button className="btn-secondary" onClick={onAutoArrange}>Auto-Arrange</button>}
        </div>
      )}

      {placedRooms.length === 0 ? (
        <p className="hint">No rooms placed on the map yet.</p>
      ) : (
        <svg
          ref={svgRef}
          viewBox={viewBox}
          className="dungeon-map-svg"
          onWheel={handleWheel}
        >
          <rect
            x={-10000} y={-10000} width={20000} height={20000} fill="transparent"
            onPointerDown={handleBackgroundPointerDown}
            onPointerMove={handleBackgroundPointerMove}
            onPointerUp={handleBackgroundPointerUp}
          />
          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
            {corridors.map((c) => (
              <g key={c.key}>
                <path d={c.d} className="dungeon-corridor-outer" />
                <path d={c.d} className="dungeon-corridor-inner" />
              </g>
            ))}

            {placedRooms.map((room) => (
              <g
                key={room.id}
                transform={`translate(${room.rect.x} ${room.rect.y})`}
                className={`dungeon-room${selectedRoomId === room.id ? " dungeon-room-selected" : ""}`}
                onPointerDown={(e) => handleRoomPointerDown(e, room)}
                onPointerMove={(e) => handleRoomPointerMove(e, room)}
                onPointerUp={(e) => handleRoomPointerUp(e, room)}
              >
                <rect width={room.rect.width} height={room.rect.height} rx={6} />
                <text x={room.rect.width / 2} y={room.rect.height / 2}>{room.name}</text>
              </g>
            ))}
          </g>
        </svg>
      )}

      {selectedRoom && (
        <div className="save-panel">
          <h3 className="section-heading">{selectedRoom.name}</h3>
          {selectedRoom.exits.length === 0 ? (
            <p className="hint">No exits.</p>
          ) : (
            selectedRoom.exits.map((exit) => (
              <p key={exit.zoneId}>{exit.label || "exit"} → {roomById.get(exit.toRoomId)?.name ?? "Unknown room"}</p>
            ))
          )}
          <button className="btn-secondary" onClick={() => setSelectedRoomId(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
