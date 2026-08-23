import { useRef, useState } from "react";
import type { Region, Settlement } from "@spark/shared";
import { describeWeather } from "@spark/shared";

const WIDTH = 720;
const HEIGHT = 480;
const REGION_RADIUS = 56;

export function WorldMapView({
  regions, settlements, canEdit, currentDay, onUpdateRegion, onToggleConnection, onSelectRegion,
}: {
  regions: Region[];
  settlements: Settlement[];
  canEdit: boolean;
  currentDay: number;
  onUpdateRegion: (id: string, patch: Partial<Region>) => void;
  onToggleConnection: (aId: string, bId: string) => void;
  onSelectRegion?: (id: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const [connectMode, setConnectMode] = useState(false);
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  const dragRef = useRef<{ id: string; startX: number; startY: number; moved: boolean } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  // Regions still at the DB default (0,0) haven't been placed yet — spread
  // them out in a simple grid for display only; nothing is persisted until
  // the DM actually drags one, at which point it gets a real position.
  const unplacedIds = regions.filter((r) => r.x === 0 && r.y === 0).map((r) => r.id);
  function displayPos(region: Region): { x: number; y: number } {
    if (region.x !== 0 || region.y !== 0) return { x: region.x, y: region.y };
    const idx = unplacedIds.indexOf(region.id);
    return { x: 120 + (idx % 4) * 160, y: 100 + Math.floor(idx / 4) * 140 };
  }

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

  function handlePointerDown(e: React.PointerEvent<SVGGElement>, region: Region) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: region.id, startX: e.clientX, startY: e.clientY, moved: false };
  }

  function handlePointerMove(e: React.PointerEvent<SVGGElement>, region: Region) {
    if (!canEdit) return;
    const drag = dragRef.current;
    if (!drag || drag.id !== region.id) return;
    if (Math.abs(e.clientX - drag.startX) > 4 || Math.abs(e.clientY - drag.startY) > 4) drag.moved = true;
    const { x, y } = toLocalCoords(e.clientX, e.clientY);
    onUpdateRegion(region.id, { x, y });
  }

  function handlePointerUp(_e: React.PointerEvent<SVGGElement>, region: Region) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && drag.id === region.id && !drag.moved) {
      handleClick(region);
    }
  }

  function handleClick(region: Region) {
    if (connectMode) {
      if (!connectFromId) {
        setConnectFromId(region.id);
      } else if (connectFromId === region.id) {
        setConnectFromId(null);
      } else {
        onToggleConnection(connectFromId, region.id);
        setConnectFromId(null);
      }
      return;
    }
    setSelectedRegionId(region.id);
    onSelectRegion?.(region.id);
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

  const selectedRegion = regions.find((r) => r.id === selectedRegionId) ?? null;
  const selectedRegionSettlements = selectedRegion ? settlements.filter((s) => s.regionId === selectedRegion.id) : [];

  return (
    <div className="zone-map">
      {canEdit && (
        <div className="button-row">
          <button
            className="btn-secondary"
            aria-pressed={connectMode}
            onClick={() => { setConnectMode((v) => !v); setConnectFromId(null); }}
          >
            {connectMode ? "Done Connecting" : "Connect Regions"}
          </button>
        </div>
      )}
      {connectMode && (
        <p className="hint">Click a region, then click another to connect or disconnect a travel route.</p>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="zone-map-svg"
        onWheel={handleWheel}
      >
        <rect
          x={0} y={0} width={WIDTH} height={HEIGHT} fill="transparent"
          onPointerDown={handleBackgroundPointerDown}
          onPointerMove={handleBackgroundPointerMove}
          onPointerUp={handleBackgroundPointerUp}
        />
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
          {regions.flatMap((region) => {
            const pos = displayPos(region);
            return region.connections
              .filter((otherId) => regions.some((r) => r.id === otherId))
              .map((otherId) => {
                const other = regions.find((r) => r.id === otherId)!;
                if (region.id > otherId) return null;
                const otherPos = displayPos(other);
                return (
                  <line
                    key={`${region.id}-${otherId}`}
                    x1={pos.x} y1={pos.y} x2={otherPos.x} y2={otherPos.y}
                    className="zone-edge"
                  />
                );
              });
          })}

          {regions.map((region) => {
            const pos = displayPos(region);
            const settlementCount = settlements.filter((s) => s.regionId === region.id).length;
            const weather = describeWeather(region.terrainCategory, region.id, currentDay);
            return (
              <g key={region.id}>
                <g
                  transform={`translate(${pos.x} ${pos.y})`}
                  className={`zone-node${connectFromId === region.id ? " zone-connecting" : ""}`}
                  onPointerDown={(e) => handlePointerDown(e, region)}
                  onPointerMove={(e) => handlePointerMove(e, region)}
                  onPointerUp={(e) => handlePointerUp(e, region)}
                >
                  <circle r={REGION_RADIUS} />
                  <text y={REGION_RADIUS + 16}>{region.name}</text>
                  <text y={REGION_RADIUS + 32} className="zone-tags-label">
                    {region.terrainCategory}{settlementCount > 0 ? ` · ${settlementCount} settlement${settlementCount === 1 ? "" : "s"}` : ""}
                  </text>
                  <text y={REGION_RADIUS + 46} className="zone-tags-label region-weather-label">{weather.condition}</text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      {selectedRegion && (
        <div className="save-panel">
          <h3 className="section-heading">{selectedRegion.name}</h3>
          <p>{selectedRegion.terrainCategory}{selectedRegion.dangerLevel ? ` · ${selectedRegion.dangerLevel}` : ""}</p>
          <p>{selectedRegion.description}</p>
          {(() => {
            const weather = describeWeather(selectedRegion.terrainCategory, selectedRegion.id, currentDay);
            return <p className="hint">Today's weather: <strong>{weather.condition}</strong> — {weather.description}</p>;
          })()}
          {selectedRegionSettlements.length > 0 && (
            <>
              <h4 className="section-heading">Settlements</h4>
              <ul className="entity-list">
                {selectedRegionSettlements.map((s) => (
                  <li key={s.id} className="world-row">
                    <span className="entity-name">{s.name}</span>
                    <span className="entity-meta">{s.settlementType}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button className="btn-secondary" onClick={() => setSelectedRegionId(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
