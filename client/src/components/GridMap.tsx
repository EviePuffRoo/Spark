import { useEffect, useMemo, useRef, useState } from "react";
import type { BattleMap, LiveCombatant, SizeCategory } from "@spark/shared";
import { SIZE_FOOTPRINT, computeReachableCells, chebyshevDistanceFeet } from "@spark/shared";
import { api } from "../api";
import { BattleTileDefs } from "./TileIcon";

const CELL = 32;
const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 560;

function footprintFor(c: LiveCombatant): number {
  return SIZE_FOOTPRINT[(c.sizeCategory ?? "medium") as SizeCategory];
}

interface RulerPoint {
  x: number;
  y: number;
}

export function GridMap({
  worldId, battleMapId, combatants, activeId, canEdit,
  onLoadBattleMap, onLeaveBattleMap, onMoveCombatant, onPlaceCombatant,
}: {
  worldId?: string;
  battleMapId?: string;
  combatants: LiveCombatant[];
  activeId: string | null;
  canEdit: boolean;
  onLoadBattleMap: (mapId: string) => void;
  onLeaveBattleMap: () => void;
  onMoveCombatant: (combatantId: string, gridX: number, gridY: number) => void;
  onPlaceCombatant: (combatantId: string, gridX: number, gridY: number) => void;
}) {
  const [battleMap, setBattleMap] = useState<BattleMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [pickerMaps, setPickerMaps] = useState<BattleMap[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (!battleMapId) {
      setBattleMap(null);
      return;
    }
    setLoading(true);
    let cancelled = false;
    api.getBattleMap(battleMapId)
      .then((m) => { if (!cancelled) setBattleMap(m); })
      .catch(() => { if (!cancelled) setBattleMap(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [battleMapId]);

  useEffect(() => {
    if (!showPicker) return;
    api.listBattleMaps(worldId).then(setPickerMaps).catch(() => setPickerMaps([]));
  }, [showPicker, worldId]);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const tokenDragRef = useRef<{ id: string; startX: number; startY: number; originGridX: number; originGridY: number; moved: boolean } | null>(null);
  const [tokenDragPos, setTokenDragPos] = useState<{ id: string; gridX: number; gridY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const [measuring, setMeasuring] = useState(false);
  const [rulerPoints, setRulerPoints] = useState<RulerPoint[]>([]);

  function toLocalCoords(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const screenPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const t = transformRef.current;
    return { x: (screenPt.x - t.x) / t.k, y: (screenPt.y - t.y) / t.k };
  }

  function toCell(clientX: number, clientY: number) {
    const { x, y } = toLocalCoords(clientX, clientY);
    return { cellX: Math.floor(x / CELL), cellY: Math.floor(y / CELL) };
  }

  function clampFootprint(cellX: number, cellY: number, size: number) {
    if (!battleMap) return { x: cellX, y: cellY };
    return {
      x: Math.max(0, Math.min(battleMap.width - size, cellX)),
      y: Math.max(0, Math.min(battleMap.height - size, cellY)),
    };
  }

  function handleTokenPointerDown(e: React.PointerEvent<SVGRectElement>, c: LiveCombatant) {
    if (measuring) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    tokenDragRef.current = { id: c.id, startX: e.clientX, startY: e.clientY, originGridX: c.gridX ?? 0, originGridY: c.gridY ?? 0, moved: false };
    setTokenDragPos({ id: c.id, gridX: c.gridX ?? 0, gridY: c.gridY ?? 0 });
  }

  function handleTokenPointerMove(e: React.PointerEvent<SVGRectElement>, c: LiveCombatant) {
    const drag = tokenDragRef.current;
    if (!drag || drag.id !== c.id) return;
    if (Math.abs(e.clientX - drag.startX) > 4 || Math.abs(e.clientY - drag.startY) > 4) drag.moved = true;
    const { cellX, cellY } = toCell(e.clientX, e.clientY);
    const size = footprintFor(c);
    const clamped = clampFootprint(cellX - Math.floor(size / 2), cellY - Math.floor(size / 2), size);
    setTokenDragPos({ id: c.id, gridX: clamped.x, gridY: clamped.y });
  }

  function handleTokenPointerUp(_e: React.PointerEvent<SVGRectElement>, c: LiveCombatant) {
    const drag = tokenDragRef.current;
    tokenDragRef.current = null;
    const dropPos = tokenDragPos;
    setTokenDragPos(null);
    if (!drag || drag.id !== c.id || !dropPos) return;
    if (!drag.moved) return;
    onMoveCombatant(c.id, dropPos.gridX, dropPos.gridY);
  }

  function handleBackgroundPointerDown(e: React.PointerEvent<SVGRectElement>) {
    if (measuring) return;
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

  function handleBackgroundClick(e: React.MouseEvent<SVGRectElement>) {
    if (!measuring) return;
    const { cellX, cellY } = toCell(e.clientX, e.clientY);
    setRulerPoints((pts) => {
      const next = [...pts, { x: cellX, y: cellY }];
      return next.length > 2 ? next.slice(next.length - 2) : next;
    });
  }

  function handleWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = -e.deltaY * 0.001;
      setTransform((t) => ({ ...t, k: Math.min(2.5, Math.max(0.3, t.k * (1 + delta))) }));
    } else {
      setTransform((t) => ({ ...t, x: t.x - e.deltaX, y: t.y - e.deltaY }));
    }
  }

  function zoomBy(factor: number) {
    setTransform((t) => ({ ...t, k: Math.min(2.5, Math.max(0.3, t.k * factor)) }));
  }
  function resetView() {
    setTransform({ x: 0, y: 0, k: 1 });
  }

  const activeCombatant = combatants.find((c) => c.id === activeId) ?? null;
  const reachable = useMemo(() => {
    if (!battleMap || !activeCombatant || activeCombatant.gridX === undefined || activeCombatant.gridY === undefined) return null;
    return computeReachableCells(battleMap, activeCombatant.gridX, activeCombatant.gridY, activeCombatant.speedFeet ?? 30);
  }, [battleMap, activeCombatant]);

  const placed = combatants.filter((c) => c.gridX !== undefined && c.gridY !== undefined && tokenDragPos?.id !== c.id);
  const unplaced = combatants.filter((c) => c.gridX === undefined || c.gridY === undefined);

  if (!battleMapId) {
    return (
      <div className="grid-map">
        <p className="hint">No battle map loaded for this encounter yet.</p>
        {canEdit && (
          <>
            <button className="btn-secondary" onClick={() => setShowPicker((v) => !v)}>
              {showPicker ? "Cancel" : "Load Battle Map"}
            </button>
            {showPicker && (
              <div className="save-panel">
                {pickerMaps.length === 0 ? (
                  <p className="hint">No battle maps yet — build one in Map Builder first.</p>
                ) : (
                  <ul className="entity-list">
                    {pickerMaps.map((m) => (
                      <li key={m.id}>
                        <button className="entity-item" onClick={() => { onLoadBattleMap(m.id); setShowPicker(false); }}>
                          <span className="entity-name">{m.name}</span>
                          <span className="entity-meta">{m.width}×{m.height}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (loading || !battleMap) {
    return <div className="grid-map"><p className="hint">Loading battle map…</p></div>;
  }

  const gridWidth = battleMap.width * CELL;
  const gridHeight = battleMap.height * CELL;
  const rulerLine = rulerPoints.length === 2 ? rulerPoints : null;
  const rulerDistance = rulerLine ? chebyshevDistanceFeet(rulerLine[0].x, rulerLine[0].y, rulerLine[1].x, rulerLine[1].y) : null;

  return (
    <div className="grid-map">
      <div className="button-row">
        <button
          className="btn-secondary"
          aria-pressed={measuring}
          onClick={() => { setMeasuring((v) => !v); setRulerPoints([]); }}
        >
          {measuring ? "Done Measuring" : "Measure"}
        </button>
        {canEdit && <button className="btn-secondary" onClick={onLeaveBattleMap}>Leave Battle Map</button>}
      </div>
      {measuring && <p className="hint">Click a cell, then another, to measure the distance between them.</p>}

      <div className="zone-map-canvas">
        <div className="zone-map-zoom-controls">
          <button type="button" className="btn-secondary" onClick={() => zoomBy(1.2)} aria-label="Zoom in">+</button>
          <button type="button" className="btn-secondary" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out">−</button>
          <button type="button" className="btn-secondary" onClick={resetView} aria-label="Reset zoom and pan">Reset</button>
        </div>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEWPORT_WIDTH} ${VIEWPORT_HEIGHT}`}
          className={`grid-map-svg${measuring ? " grid-map-measuring" : ""}`}
          onWheel={handleWheel}
        >
          <BattleTileDefs />
          <rect
            x={-2000} y={-2000} width={4000} height={4000} fill="transparent"
            onPointerDown={handleBackgroundPointerDown}
            onPointerMove={handleBackgroundPointerMove}
            onPointerUp={handleBackgroundPointerUp}
            onClick={handleBackgroundClick}
          />
          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
            <rect width={gridWidth} height={gridHeight} className="grid-map-bg" pointerEvents="none" />
            {battleMap.tiles.map((t) => (
              <use key={`${t.x},${t.y}`} href={`#tile-${t.tileId}`} x={t.x * CELL} y={t.y * CELL} width={CELL} height={CELL} pointerEvents="none" />
            ))}
            {Array.from({ length: battleMap.width + 1 }, (_, i) => (
              <line key={`v${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={gridHeight} className="grid-map-line" pointerEvents="none" />
            ))}
            {Array.from({ length: battleMap.height + 1 }, (_, i) => (
              <line key={`h${i}`} x1={0} y1={i * CELL} x2={gridWidth} y2={i * CELL} className="grid-map-line" pointerEvents="none" />
            ))}

            {reachable && [...reachable].map((key) => {
              const [x, y] = key.split(",").map(Number);
              if (x === activeCombatant!.gridX && y === activeCombatant!.gridY) return null;
              return <rect key={key} x={x * CELL} y={y * CELL} width={CELL} height={CELL} className="grid-map-reachable" pointerEvents="none" />;
            })}

            {rulerLine && (
              <g pointerEvents="none">
                <line
                  x1={rulerLine[0].x * CELL + CELL / 2} y1={rulerLine[0].y * CELL + CELL / 2}
                  x2={rulerLine[1].x * CELL + CELL / 2} y2={rulerLine[1].y * CELL + CELL / 2}
                  className="grid-map-ruler-line"
                />
                <text
                  x={((rulerLine[0].x + rulerLine[1].x) / 2) * CELL + CELL / 2}
                  y={((rulerLine[0].y + rulerLine[1].y) / 2) * CELL + CELL / 2 - 6}
                  className="grid-map-ruler-label"
                  textAnchor="middle"
                >
                  {rulerDistance} ft
                </text>
              </g>
            )}

            {placed.map((c) => {
              const size = footprintFor(c);
              return (
                <g key={c.id} className={`grid-token grid-token-${c.kind}${c.id === activeId ? " grid-token-active-turn" : ""}`}>
                  <rect
                    x={(c.gridX ?? 0) * CELL} y={(c.gridY ?? 0) * CELL}
                    width={size * CELL} height={size * CELL}
                    rx={6}
                    onPointerDown={(e) => handleTokenPointerDown(e, c)}
                    onPointerMove={(e) => handleTokenPointerMove(e, c)}
                    onPointerUp={(e) => handleTokenPointerUp(e, c)}
                  />
                  <text x={(c.gridX ?? 0) * CELL + (size * CELL) / 2} y={(c.gridY ?? 0) * CELL + size * CELL + 14} textAnchor="middle">{c.name}</text>
                </g>
              );
            })}

            {tokenDragPos && (() => {
              const dragged = combatants.find((c) => c.id === tokenDragPos.id);
              if (!dragged) return null;
              const size = footprintFor(dragged);
              const origin = tokenDragRef.current;
              const movedFeet = origin ? chebyshevDistanceFeet(origin.originGridX, origin.originGridY, tokenDragPos.gridX, tokenDragPos.gridY) : 0;
              const overSpeed = movedFeet > (dragged.speedFeet ?? 30);
              return (
                <g className={`grid-token grid-token-${dragged.kind} grid-token-dragging${overSpeed ? " grid-token-over-speed" : ""}`}>
                  <rect x={tokenDragPos.gridX * CELL} y={tokenDragPos.gridY * CELL} width={size * CELL} height={size * CELL} rx={6} />
                  <text x={tokenDragPos.gridX * CELL + (size * CELL) / 2} y={tokenDragPos.gridY * CELL - 8} textAnchor="middle" className="grid-token-drag-distance">
                    {movedFeet} ft
                  </text>
                </g>
              );
            })()}
          </g>
        </svg>
      </div>

      {unplaced.length > 0 && (
        <div className="save-panel">
          <h3 className="section-heading">Not Yet Placed</h3>
          <ul className="entity-list">
            {unplaced.map((c) => (
              <li key={c.id} className="world-row">
                <span className="entity-name">{c.name}</span>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    const size = footprintFor(c);
                    const clamped = clampFootprint(Math.floor(battleMap.width / 2), Math.floor(battleMap.height / 2), size);
                    onPlaceCombatant(c.id, clamped.x, clamped.y);
                  }}
                >
                  Place on Grid
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
