import { useEffect, useMemo, useRef, useState } from "react";
import type { BattleMap, LiveCombatant, SizeCategory, AoeShapeKind, PlacedTile } from "@spark/shared";
import { SIZE_FOOTPRINT, computeReachableCells, chebyshevDistanceFeet, AOE_SHAPE_KINDS, computeAoeCells, footprintIntersectsTemplate, BATTLE_TILE_BY_ID } from "@spark/shared";
import { api } from "../api";
import { BattleTileDefs } from "./TileIcon";
import { TileShading, TileShadingDefs, buildTileShading } from "./TileShading";

const CELL = 32;
const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 560;
// How often a drag broadcasts its in-progress position to other viewers
// (see onDragBroadcast below) — frequent enough to look like a smooth
// glide, far below animation-frame rate so it stays cheap for everyone
// watching.
const DRAG_BROADCAST_THROTTLE_MS = 80;

function footprintFor(c: LiveCombatant): number {
  return SIZE_FOOTPRINT[(c.sizeCategory ?? "medium") as SizeCategory];
}

interface RulerPoint {
  x: number;
  y: number;
}

export function GridMap({
  worldId, battleMapId, combatants, activeId, canEdit,
  exploredCells, visibleCells, openDoorCells,
  onLoadBattleMap, onLeaveBattleMap, onMoveCombatant, onPlaceCombatant, onDragBroadcast, onTemplateTargetsChange, onToggleDoor,
}: {
  worldId?: string;
  battleMapId?: string;
  combatants: LiveCombatant[];
  activeId: string | null;
  canEdit: boolean;
  // "x,y" keys ever explored and the party's current-instant vision,
  // respectively — both server-computed, and both undefined for the DM
  // (who always sees the full map). Absent entirely when the caller has
  // no fog data (e.g. no map active), in which case fog rendering is
  // skipped and the map renders fully lit, same as the owner's view.
  exploredCells?: string[];
  visibleCells?: string[];
  // "x,y" keys of door tiles currently toggled open — every door defaults
  // to closed. Always present when a map is active, owner or not (not
  // secret, unlike vision).
  openDoorCells?: string[];
  onLoadBattleMap: (mapId: string) => void;
  onLeaveBattleMap: () => void;
  onMoveCombatant: (combatantId: string, gridX: number, gridY: number) => void;
  onPlaceCombatant: (combatantId: string, gridX: number, gridY: number) => void;
  // Fired (throttled) with a token's in-progress drag position so other
  // connected viewers can watch it glide in real time — separate from
  // onMoveCombatant, which only fires once, on drop, and is what actually
  // persists. Omit to disable broadcasting (e.g. outside party mode,
  // where there's no live channel to broadcast into anyway).
  onDragBroadcast?: (combatantId: string, gridX: number, gridY: number) => void;
  // Fired with the ids of every placed combatant currently caught by the
  // active AoE template (by committed grid position, not an in-progress
  // drag preview) — [] whenever no template is placed. Lets the caller
  // offer a batch action ("apply to all in template") without GridMap
  // itself needing to know about damage/conditions.
  onTemplateTargetsChange?: (ids: string[]) => void;
  // Fired when a door tile is clicked to toggle it open/closed. Omitted by
  // a read-only mirror (PresentationView), same as onMoveCombatant={noop}
  // there — the map still renders correct open/closed art either way.
  onToggleDoor?: (x: number, y: number) => void;
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
  const lastBroadcastAtRef = useRef(0);
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const [measuring, setMeasuring] = useState(false);
  const [rulerPoints, setRulerPoints] = useState<RulerPoint[]>([]);

  const [placingTemplate, setPlacingTemplate] = useState(false);
  const [templateKind, setTemplateKind] = useState<AoeShapeKind>("circle");
  const [templatePoints, setTemplatePoints] = useState<RulerPoint[]>([]);

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
    if (measuring || placingTemplate) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    tokenDragRef.current = { id: c.id, startX: e.clientX, startY: e.clientY, originGridX: c.gridX ?? 0, originGridY: c.gridY ?? 0, moved: false };
    setTokenDragPos({ id: c.id, gridX: c.gridX ?? 0, gridY: c.gridY ?? 0 });
    lastBroadcastAtRef.current = 0;
  }

  function handleTokenPointerMove(e: React.PointerEvent<SVGRectElement>, c: LiveCombatant) {
    const drag = tokenDragRef.current;
    if (!drag || drag.id !== c.id) return;
    if (Math.abs(e.clientX - drag.startX) > 4 || Math.abs(e.clientY - drag.startY) > 4) drag.moved = true;
    const { cellX, cellY } = toCell(e.clientX, e.clientY);
    const size = footprintFor(c);
    const clamped = clampFootprint(cellX - Math.floor(size / 2), cellY - Math.floor(size / 2), size);
    setTokenDragPos({ id: c.id, gridX: clamped.x, gridY: clamped.y });

    if (onDragBroadcast && drag.moved) {
      const now = Date.now();
      if (now - lastBroadcastAtRef.current >= DRAG_BROADCAST_THROTTLE_MS) {
        lastBroadcastAtRef.current = now;
        onDragBroadcast(c.id, clamped.x, clamped.y);
      }
    }
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
    if (measuring || placingTemplate) return;
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
    if (measuring) {
      const { cellX, cellY } = toCell(e.clientX, e.clientY);
      setRulerPoints((pts) => {
        const next = [...pts, { x: cellX, y: cellY }];
        return next.length > 2 ? next.slice(next.length - 2) : next;
      });
    } else if (placingTemplate) {
      const { cellX, cellY } = toCell(e.clientX, e.clientY);
      setTemplatePoints((pts) => {
        const next = [...pts, { x: cellX, y: cellY }];
        return next.length > 2 ? next.slice(next.length - 2) : next;
      });
    }
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
    return computeReachableCells(battleMap, activeCombatant.gridX, activeCombatant.gridY, activeCombatant.speedFeet ?? 30, undefined, activeCombatant.flying);
  }, [battleMap, activeCombatant]);

  // Fog of war only ever applies to a non-owner's own view — the DM's
  // canvas always renders fully lit, since they're the one drawing the
  // map. `visibleCells` is only ever populated (by the server) for a
  // non-owner viewer in the first place, so the `!canEdit` check here is
  // belt-and-suspenders against a stale/owner-viewed prop.
  const fogActive = !canEdit && visibleCells !== undefined;
  const exploredSet = useMemo(() => new Set(exploredCells ?? []), [exploredCells]);
  const visibleSet = useMemo(() => new Set(visibleCells ?? []), [visibleCells]);
  const openDoorSet = useMemo(() => new Set(openDoorCells ?? []), [openDoorCells]);

  const templateCells = useMemo(() => {
    if (!battleMap || templatePoints.length !== 2) return null;
    const [origin, target] = templatePoints;
    return computeAoeCells(battleMap, { kind: templateKind, originX: origin.x, originY: origin.y, targetX: target.x, targetY: target.y });
  }, [battleMap, templateKind, templatePoints]);

  // Split the tile list by layer once per map rather than walking all of it
  // three times per render. A full-size map is 40x30, and every pointermove
  // of a token drag re-renders this component — so the difference here is
  // per-frame work during a drag, not one-time setup cost.
  const tileLayers = useMemo(() => {
    const floor: PlacedTile[] = [];
    const decor: PlacedTile[] = [];
    const gmOnly: PlacedTile[] = [];
    for (const t of battleMap?.tiles ?? []) {
      if (t.layer === "decor") decor.push(t);
      else if (t.layer === "gmOnly") gmOnly.push(t);
      else floor.push(t);
    }
    return { floor, decor, gmOnly };
  }, [battleMap]);

  const shading = useMemo(
    () => (battleMap ? buildTileShading(battleMap.tiles, battleMap.width, battleMap.height, CELL) : null),
    [battleMap],
  );

  // The three tile layers as finished elements. None of their inputs change
  // while a token is being dragged, so React reuses these whole subtrees and
  // reconciles only the token that actually moved — instead of rebuilding
  // every tile in the map on each pointermove.
  const floorTileElements = useMemo(() => tileLayers.floor.map((t) => {
    const isDoor = !!BATTLE_TILE_BY_ID[t.tileId]?.isDoor;
    const doorKey = `${t.x},${t.y}`;
    const isOpen = isDoor && openDoorSet.has(doorKey);
    const href = isOpen ? `#tile-${t.tileId}-open` : `#tile-${t.tileId}`;
    // A door beyond current fog isn't clickable for a non-owner — you have
    // to have at least seen it to act on it, same as everything else
    // fog-gates in this component.
    const canToggle = isDoor && !!onToggleDoor && !measuring && !placingTemplate && (canEdit || exploredSet.has(doorKey));
    return (
      <g key={doorKey}>
        <use href={href} x={t.x * CELL} y={t.y * CELL} width={CELL} height={CELL} pointerEvents="none" />
        {t.elevation !== undefined && (
          <text x={t.x * CELL + CELL - 2} y={t.y * CELL + 9} className="grid-map-elevation-label" textAnchor="end" pointerEvents="none">
            {t.elevation > 0 ? `+${t.elevation}` : t.elevation}
          </text>
        )}
        {canToggle && (
          <rect
            x={t.x * CELL} y={t.y * CELL} width={CELL} height={CELL}
            className="grid-map-door-toggle"
            onClick={(e) => { e.stopPropagation(); onToggleDoor!(t.x, t.y); }}
          >
            <title>{isOpen ? "Close door" : "Open door"}</title>
          </rect>
        )}
      </g>
    );
  }), [tileLayers, openDoorSet, exploredSet, measuring, placingTemplate, canEdit, onToggleDoor]);

  const decorTileElements = useMemo(() => tileLayers.decor.map((t) => (
    <use key={`decor-${t.x},${t.y}`} href={`#tile-${t.tileId}`} x={t.x * CELL} y={t.y * CELL} width={CELL} height={CELL} pointerEvents="none" />
  )), [tileLayers]);

  // The server already strips gmOnly tiles before they ever reach a
  // non-owner viewer (see toBattleMapDTO) — canEdit here is
  // belt-and-suspenders, same pattern as fogActive above.
  const gmOnlyTileElements = useMemo(() => (
    canEdit ? tileLayers.gmOnly.map((t) => (
      <use key={`gm-${t.x},${t.y}`} href={`#tile-${t.tileId}`} x={t.x * CELL} y={t.y * CELL} width={CELL} height={CELL} pointerEvents="none" />
    )) : null
  ), [tileLayers, canEdit]);

  // Pure geometry — nothing about the grid lines changes while a token
  // moves, so they're built once per map size instead of every frame.
  const gridLines = useMemo(() => {
    if (!battleMap) return null;
    const w = battleMap.width * CELL;
    const h = battleMap.height * CELL;
    return (
      <>
        {Array.from({ length: battleMap.width + 1 }, (_, i) => (
          <line key={`v${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={h} className="grid-map-line" pointerEvents="none" />
        ))}
        {Array.from({ length: battleMap.height + 1 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * CELL} x2={w} y2={i * CELL} className="grid-map-line" pointerEvents="none" />
        ))}
      </>
    );
  }, [battleMap]);

  const placed = combatants.filter((c) => c.gridX !== undefined && c.gridY !== undefined);
  const unplaced = combatants.filter((c) => c.gridX === undefined || c.gridY === undefined);

  // Joined into a string so the effect below only re-fires when the actual
  // set of targeted ids changes, not on every render (placed/templateCells
  // are fresh array/object references each render even when unchanged).
  const templateTargetKey = useMemo(() => {
    if (!templateCells) return "";
    return placed
      .filter((c) => footprintIntersectsTemplate(c.gridX ?? 0, c.gridY ?? 0, footprintFor(c), templateCells))
      .map((c) => c.id)
      .join(",");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combatants, templateCells]);

  useEffect(() => {
    onTemplateTargetsChange?.(templateTargetKey ? templateTargetKey.split(",") : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateTargetKey]);

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
                  <p className="hint">No battle maps yet. Build one in Map Builder first.</p>
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
          onClick={() => { setMeasuring((v) => !v); setRulerPoints([]); if (!measuring) { setPlacingTemplate(false); setTemplatePoints([]); } }}
        >
          {measuring ? "Done Measuring" : "Measure"}
        </button>
        <select value={templateKind} onChange={(e) => { setTemplateKind(e.target.value as AoeShapeKind); setTemplatePoints([]); }}>
          {AOE_SHAPE_KINDS.map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}
        </select>
        <button
          className="btn-secondary"
          aria-pressed={placingTemplate}
          onClick={() => { setPlacingTemplate((v) => !v); setTemplatePoints([]); if (!placingTemplate) { setMeasuring(false); setRulerPoints([]); } }}
        >
          {placingTemplate ? "Done Templating" : "Place Template"}
        </button>
        {canEdit && <button className="btn-secondary" onClick={onLeaveBattleMap}>Leave Battle Map</button>}
      </div>
      {measuring && <p className="hint">Click a cell, then another, to measure the distance between them.</p>}
      {placingTemplate && <p className="hint">Click the template's origin, then click again to aim and size it.</p>}

      <div className="zone-map-canvas">
        <div className="zone-map-zoom-controls">
          <button type="button" className="btn-secondary" onClick={() => zoomBy(1.2)} aria-label="Zoom in">+</button>
          <button type="button" className="btn-secondary" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out">−</button>
          <button type="button" className="btn-secondary" onClick={resetView} aria-label="Reset zoom and pan">Reset</button>
        </div>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEWPORT_WIDTH} ${VIEWPORT_HEIGHT}`}
          className={`grid-map-svg${measuring || placingTemplate ? " grid-map-measuring" : ""}`}
          onWheel={handleWheel}
        >
          <BattleTileDefs />
          <defs><TileShadingDefs /></defs>
          <rect
            x={-2000} y={-2000} width={4000} height={4000} fill="transparent"
            onPointerDown={handleBackgroundPointerDown}
            onPointerMove={handleBackgroundPointerMove}
            onPointerUp={handleBackgroundPointerUp}
            onClick={handleBackgroundClick}
          />
          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
            <rect width={gridWidth} height={gridHeight} className="grid-map-bg" pointerEvents="none" />
            {floorTileElements}
            {shading && <TileShading shading={shading} />}
            {decorTileElements}
            {gmOnlyTileElements}
            {gridLines}

            {reachable && [...reachable].map((key) => {
              const [x, y] = key.split(",").map(Number);
              if (x === activeCombatant!.gridX && y === activeCombatant!.gridY) return null;
              if (fogActive && !exploredSet.has(key)) return null;
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

            {templateCells && [...templateCells].map((key) => {
              const [x, y] = key.split(",").map(Number);
              return <rect key={`tmpl-${key}`} x={x * CELL} y={y * CELL} width={CELL} height={CELL} className="grid-map-template" pointerEvents="none" />;
            })}

            {placed.map((c) => {
              const size = footprintFor(c);
              const isDragging = tokenDragPos?.id === c.id;
              // Same <rect> stays mounted for the whole drag — just its x/y
              // change — rather than swapping in a separate preview element,
              // which would drop the pointer capture set on pointerdown the
              // instant React removed the original node (breaking anything
              // but the very fastest single-gesture drags).
              const gridX = isDragging ? tokenDragPos.gridX : (c.gridX ?? 0);
              const gridY = isDragging ? tokenDragPos.gridY : (c.gridY ?? 0);
              const origin = isDragging ? tokenDragRef.current : null;
              const movedFeet = origin ? chebyshevDistanceFeet(origin.originGridX, origin.originGridY, gridX, gridY) : 0;
              const overSpeed = isDragging && movedFeet > (c.speedFeet ?? 30);
              const inTemplate = !!templateCells && footprintIntersectsTemplate(gridX, gridY, size, templateCells);
              return (
                <g
                  key={c.id}
                  className={`grid-token grid-token-${c.kind}${c.id === activeId ? " grid-token-active-turn" : ""}${isDragging ? " grid-token-dragging" : ""}${overSpeed ? " grid-token-over-speed" : ""}${inTemplate ? " grid-token-in-template" : ""}${c.flying ? " grid-token-flying" : ""}`}
                >
                  <rect
                    x={gridX * CELL} y={gridY * CELL}
                    width={size * CELL} height={size * CELL}
                    rx={6}
                    onPointerDown={(e) => handleTokenPointerDown(e, c)}
                    onPointerMove={(e) => handleTokenPointerMove(e, c)}
                    onPointerUp={(e) => handleTokenPointerUp(e, c)}
                  >
                    {c.flying && <title>Flying</title>}
                  </rect>
                  {isDragging ? (
                    <text x={gridX * CELL + (size * CELL) / 2} y={gridY * CELL - 8} textAnchor="middle" className="grid-token-drag-distance">
                      {movedFeet} ft
                    </text>
                  ) : (
                    <text x={gridX * CELL + (size * CELL) / 2} y={gridY * CELL + size * CELL + 14} textAnchor="middle">{c.name}</text>
                  )}
                </g>
              );
            })}

            {fogActive && Array.from({ length: battleMap.height }, (_, y) =>
              Array.from({ length: battleMap.width }, (_, x) => {
                const key = `${x},${y}`;
                if (visibleSet.has(key)) return null;
                const explored = exploredSet.has(key);
                return (
                  <rect
                    key={`fog-${key}`}
                    x={x * CELL} y={y * CELL} width={CELL} height={CELL}
                    className={explored ? "grid-map-fog-dim" : "grid-map-fog-hidden"}
                    pointerEvents="none"
                  />
                );
              }),
            )}
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
