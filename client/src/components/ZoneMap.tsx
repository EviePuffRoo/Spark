import { useEffect, useRef, useState } from "react";
import type { EncounterZone, EncounterZoneEffect, LiveCombatant, Location, SearchResult } from "@spark/shared";
import { zoneDistances } from "../zoneGraph";
import { api } from "../api";
import { EntitySearchPicker } from "./EntitySearchPicker";
import { LocationCardView } from "./LocationCardView";

const WIDTH = 720;
const HEIGHT = 480;
const ZONE_RADIUS = 64;
const TOKEN_RADIUS = 12;

interface Token {
  combatant: LiveCombatant;
  x: number;
  y: number;
}

function tokensForZone(zone: EncounterZone, combatants: LiveCombatant[]): Token[] {
  const inZone = combatants.filter((c) => c.zoneId === zone.id);
  const offsetRadius = inZone.length > 1 ? 26 : 0;
  return inZone.map((combatant, i) => {
    const angle = (i / inZone.length) * Math.PI * 2;
    return {
      combatant,
      x: zone.x + Math.cos(angle) * offsetRadius,
      y: zone.y + Math.sin(angle) * offsetRadius,
    };
  });
}

export function ZoneMap({
  zones, zoneEffects, combatants, activeId, canEdit, worldId,
  onAddZone, onUpdateZone, onDeleteZone, onToggleConnection,
  onAddEffect, onRemoveEffect, onMoveCombatant, onLoadTemplate,
}: {
  zones: EncounterZone[];
  zoneEffects: EncounterZoneEffect[];
  combatants: LiveCombatant[];
  activeId: string | null;
  canEdit: boolean;
  worldId?: string;
  onAddZone: () => void;
  onUpdateZone: (id: string, patch: Partial<EncounterZone>) => void;
  onDeleteZone: (id: string) => void;
  onToggleConnection: (aId: string, bId: string) => void;
  onAddEffect: (zoneId: string, label: string, durationRounds: number) => void;
  onRemoveEffect: (id: string) => void;
  onMoveCombatant: (combatantId: string, zoneId: string) => void;
  onLoadTemplate: (zones: EncounterZone[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const [connectMode, setConnectMode] = useState(false);
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [effectLabel, setEffectLabel] = useState("");
  const [effectDuration, setEffectDuration] = useState(1);
  const [tagsDraft, setTagsDraft] = useState<Record<string, string>>({});
  const [hazardLabelDraft, setHazardLabelDraft] = useState<Record<string, string>>({});
  const [hazardDamageDraft, setHazardDamageDraft] = useState<Record<string, string>>({});
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showLoadTemplate, setShowLoadTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateStatus, setTemplateStatus] = useState<"idle" | "saving">("idle");
  const [linkedLocation, setLinkedLocation] = useState<Location | null>(null);

  const zoneDragRef = useRef<{ id: string; startX: number; startY: number; moved: boolean } | null>(null);
  const tokenDragRef = useRef<{ id: string; startX: number; startY: number; moved: boolean } | null>(null);
  const [tokenDragPos, setTokenDragPos] = useState<{ id: string; x: number; y: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

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

  function handleZonePointerDown(e: React.PointerEvent<SVGGElement>, zone: EncounterZone) {
    // Non-owners can't drag zones, but pointer capture still needs to start
    // here so pointerup below can detect a plain (non-dragged) click and
    // open the read-only zone detail panel.
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    zoneDragRef.current = { id: zone.id, startX: e.clientX, startY: e.clientY, moved: false };
  }

  function handleZonePointerMove(e: React.PointerEvent<SVGGElement>, zone: EncounterZone) {
    if (!canEdit) return;
    const drag = zoneDragRef.current;
    if (!drag || drag.id !== zone.id) return;
    if (Math.abs(e.clientX - drag.startX) > 4 || Math.abs(e.clientY - drag.startY) > 4) drag.moved = true;
    const { x, y } = toLocalCoords(e.clientX, e.clientY);
    onUpdateZone(zone.id, { x, y });
  }

  function handleZonePointerUp(_e: React.PointerEvent<SVGGElement>, zone: EncounterZone) {
    const drag = zoneDragRef.current;
    zoneDragRef.current = null;
    if (drag && drag.id === zone.id && !drag.moved) {
      handleZoneClick(zone);
    }
  }

  function handleZoneClick(zone: EncounterZone) {
    if (connectMode) {
      if (!connectFromId) {
        setConnectFromId(zone.id);
      } else if (connectFromId === zone.id) {
        setConnectFromId(null);
      } else {
        onToggleConnection(connectFromId, zone.id);
        setConnectFromId(null);
      }
      return;
    }
    setSelectedZoneId(zone.id);
  }

  function handleTokenPointerDown(e: React.PointerEvent<SVGCircleElement>, token: Token) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    tokenDragRef.current = { id: token.combatant.id, startX: e.clientX, startY: e.clientY, moved: false };
    setTokenDragPos({ id: token.combatant.id, x: token.x, y: token.y });
  }

  function handleTokenPointerMove(e: React.PointerEvent<SVGCircleElement>, token: Token) {
    const drag = tokenDragRef.current;
    if (!drag || drag.id !== token.combatant.id) return;
    if (Math.abs(e.clientX - drag.startX) > 4 || Math.abs(e.clientY - drag.startY) > 4) drag.moved = true;
    const { x, y } = toLocalCoords(e.clientX, e.clientY);
    setTokenDragPos({ id: token.combatant.id, x, y });
  }

  function handleTokenPointerUp(_e: React.PointerEvent<SVGCircleElement>, token: Token) {
    const drag = tokenDragRef.current;
    tokenDragRef.current = null;
    const dropPos = tokenDragPos;
    setTokenDragPos(null);
    if (!drag || drag.id !== token.combatant.id || !drag.moved || !dropPos) return;

    const target = zones.find((z) => Math.hypot(z.x - dropPos.x, z.y - dropPos.y) <= ZONE_RADIUS);
    if (target) onMoveCombatant(token.combatant.id, target.id);
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

  const activeCombatant = combatants.find((c) => c.id === activeId) ?? null;
  const reachable = activeCombatant?.zoneId ? zoneDistances(zones, activeCombatant.zoneId) : null;
  const unplaced = combatants.filter((c) => !c.zoneId || !zones.some((z) => z.id === c.zoneId));
  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;
  const selectedZoneLocationId = selectedZone?.locationId;

  useEffect(() => {
    if (!selectedZoneLocationId) {
      setLinkedLocation(null);
      return;
    }
    let cancelled = false;
    api.getLocation(selectedZoneLocationId)
      .then((loc) => { if (!cancelled) setLinkedLocation(loc); })
      .catch(() => { if (!cancelled) setLinkedLocation(null); });
    return () => { cancelled = true; };
  }, [selectedZoneLocationId]);

  async function handleSaveTemplate() {
    if (!templateName.trim() || zones.length === 0) return;
    setTemplateStatus("saving");
    try {
      await api.saveZoneMapTemplate({ name: templateName.trim(), zones, worldId: worldId ?? null });
      setTemplateName("");
      setShowSaveTemplate(false);
    } finally {
      setTemplateStatus("idle");
    }
  }

  async function handleLoadTemplateSelect(result: SearchResult) {
    setShowLoadTemplate(false);
    const template = await api.getZoneMapTemplate(result.id);
    onLoadTemplate(template.zones);
  }

  return (
    <div className="zone-map">
      <div className="button-row">
        {canEdit && <button className="btn-secondary" onClick={onAddZone}>+ Add Zone</button>}
        {canEdit && (
          <button
            className="btn-secondary"
            aria-pressed={connectMode}
            onClick={() => { setConnectMode((v) => !v); setConnectFromId(null); }}
          >
            {connectMode ? "Done Connecting" : "Connect Zones"}
          </button>
        )}
        {canEdit && (
          <button className="btn-secondary" aria-expanded={showSaveTemplate} onClick={() => { setShowSaveTemplate((v) => !v); setShowLoadTemplate(false); }}>
            Save as Template
          </button>
        )}
        {canEdit && (
          <button className="btn-secondary" aria-expanded={showLoadTemplate} onClick={() => { setShowLoadTemplate((v) => !v); setShowSaveTemplate(false); }}>
            Load Template
          </button>
        )}
      </div>
      {connectMode && (
        <p className="hint">Click a zone, then click another to connect or disconnect them.</p>
      )}

      {showSaveTemplate && (
        <div className="save-panel">
          <label className="field">
            <span>Template name</span>
            <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Bridge Ambush" />
          </label>
          {zones.length === 0 ? (
            <p className="hint">Add at least one zone before saving a template.</p>
          ) : (
            <button className="btn-primary" onClick={handleSaveTemplate} disabled={templateStatus === "saving" || !templateName.trim()}>
              {templateStatus === "saving" ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      )}

      {showLoadTemplate && (
        <div className="save-panel">
          <EntitySearchPicker type="zoneMapTemplate" onSelect={handleLoadTemplateSelect} placeholder="Search zone map templates…" />
        </div>
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
          {zones.flatMap((zone) =>
            zone.connections
              .filter((otherId) => zones.some((z) => z.id === otherId))
              .map((otherId) => {
                const other = zones.find((z) => z.id === otherId)!;
                if (zone.id > otherId) return null; // draw each edge once
                return (
                  <line
                    key={`${zone.id}-${otherId}`}
                    x1={zone.x} y1={zone.y} x2={other.x} y2={other.y}
                    className="zone-edge"
                  />
                );
              }),
          )}

          {zones.map((zone) => {
            const isActive = activeCombatant?.zoneId === zone.id;
            const distance = reachable?.get(zone.id);
            const isReachable = !isActive && distance === 1;
            const effects = zoneEffects.filter((e) => e.zoneId === zone.id);
            const tokens = tokensForZone(zone, combatants).filter((t) => tokenDragPos?.id !== t.combatant.id);
            return (
              <g key={zone.id}>
                <g
                  transform={`translate(${zone.x} ${zone.y})`}
                  className={`zone-node${isActive ? " zone-active-turn" : ""}${isReachable ? " zone-reachable" : ""}${!zone.revealed ? " zone-hidden" : ""}${connectFromId === zone.id ? " zone-connecting" : ""}`}
                  onPointerDown={(e) => handleZonePointerDown(e, zone)}
                  onPointerMove={(e) => handleZonePointerMove(e, zone)}
                  onPointerUp={(e) => handleZonePointerUp(e, zone)}
                >
                  <circle r={ZONE_RADIUS} />
                  <text y={ZONE_RADIUS + 16}>{zone.name}</text>
                  {zone.tags.length > 0 && <text y={ZONE_RADIUS + 32} className="zone-tags-label">{zone.tags.join(" · ")}</text>}
                </g>
                {effects.map((effect, i) => (
                  <text key={effect.id} x={zone.x} y={zone.y - ZONE_RADIUS - 8 - i * 14} className="zone-effect-badge" textAnchor="middle">
                    {effect.label} (through round {effect.expiresAtRound})
                  </text>
                ))}
                {tokens.map((token) => (
                  <g key={token.combatant.id} transform={`translate(${token.x} ${token.y})`} className={`zone-token zone-token-${token.combatant.kind}`}>
                    <circle
                      r={TOKEN_RADIUS}
                      onPointerDown={(e) => handleTokenPointerDown(e, token)}
                      onPointerMove={(e) => handleTokenPointerMove(e, token)}
                      onPointerUp={(e) => handleTokenPointerUp(e, token)}
                    />
                    <text y={TOKEN_RADIUS + 12}>{token.combatant.name}</text>
                  </g>
                ))}
              </g>
            );
          })}

          {tokenDragPos && (() => {
            const dragged = combatants.find((c) => c.id === tokenDragPos.id);
            if (!dragged) return null;
            return (
              <g transform={`translate(${tokenDragPos.x} ${tokenDragPos.y})`} className={`zone-token zone-token-${dragged.kind} zone-token-dragging`}>
                <circle r={TOKEN_RADIUS} />
                <text y={TOKEN_RADIUS + 12}>{dragged.name}</text>
              </g>
            );
          })()}
        </g>
      </svg>

      {unplaced.length > 0 && (
        <div className="save-panel">
          <h3 className="section-heading">Not Yet Placed</h3>
          <ul className="entity-list">
            {unplaced.map((c) => (
              <li key={c.id} className="world-row">
                <span className="entity-name">{c.name}</span>
                {zones.length > 0 && (
                  <select onChange={(e) => { if (e.target.value) onMoveCombatant(c.id, e.target.value); }} defaultValue="">
                    <option value="" disabled>Place in…</option>
                    {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedZone && (
        <div className="save-panel">
          <h3 className="section-heading">Zone: {selectedZone.name}</h3>
          {canEdit ? (
            <>
              <label className="field">
                <span>Name</span>
                <input type="text" value={selectedZone.name} onChange={(e) => onUpdateZone(selectedZone.id, { name: e.target.value })} />
              </label>
              <label className="field">
                <span>Tags (comma separated)</span>
                <input
                  type="text"
                  value={tagsDraft[selectedZone.id] ?? selectedZone.tags.join(", ")}
                  onChange={(e) => setTagsDraft((d) => ({ ...d, [selectedZone.id]: e.target.value }))}
                  onBlur={(e) => onUpdateZone(selectedZone.id, { tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                  placeholder="cover, elevated, on fire"
                />
              </label>
              <label className="field">
                <input type="checkbox" checked={selectedZone.revealed} onChange={(e) => onUpdateZone(selectedZone.id, { revealed: e.target.checked })} />
                {" "}Revealed to party
              </label>

              <h4 className="section-heading">Location</h4>
              {selectedZone.locationId ? (
                <>
                  {linkedLocation && <LocationCardView location={linkedLocation} />}
                  <button className="btn-secondary" onClick={() => onUpdateZone(selectedZone.id, { locationId: undefined })}>Clear Location Link</button>
                </>
              ) : (
                <EntitySearchPicker type="location" onSelect={(r) => onUpdateZone(selectedZone.id, { locationId: r.id })} placeholder="Link a location…" />
              )}

              <h4 className="section-heading">Hazard</h4>
              {selectedZone.hazard ? (
                <>
                  <p>⚠ {selectedZone.hazard.label} ({selectedZone.hazard.damage} damage)</p>
                  <button className="btn-secondary" onClick={() => onUpdateZone(selectedZone.id, { hazard: undefined })}>Clear Hazard</button>
                </>
              ) : (
                <>
                  <label className="field">
                    <span>Hazard label</span>
                    <input
                      type="text"
                      value={hazardLabelDraft[selectedZone.id] ?? ""}
                      onChange={(e) => setHazardLabelDraft((d) => ({ ...d, [selectedZone.id]: e.target.value }))}
                      placeholder="Spike trap, Collapsing floor…"
                    />
                  </label>
                  <label className="field">
                    <span>Damage</span>
                    <input
                      type="number"
                      min={1}
                      value={hazardDamageDraft[selectedZone.id] ?? ""}
                      onChange={(e) => setHazardDamageDraft((d) => ({ ...d, [selectedZone.id]: e.target.value }))}
                    />
                  </label>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      const label = (hazardLabelDraft[selectedZone.id] ?? "").trim();
                      const damage = Math.trunc(Number(hazardDamageDraft[selectedZone.id]));
                      if (!label || !damage || damage <= 0) return;
                      onUpdateZone(selectedZone.id, { hazard: { label, damage } });
                      setHazardLabelDraft((d) => ({ ...d, [selectedZone.id]: "" }));
                      setHazardDamageDraft((d) => ({ ...d, [selectedZone.id]: "" }));
                    }}
                  >
                    Set Hazard
                  </button>
                </>
              )}

              <h4 className="section-heading">Effects</h4>
              {zoneEffects.filter((e) => e.zoneId === selectedZone.id).map((effect) => (
                <div key={effect.id} className="button-row">
                  <span>{effect.label} (through round {effect.expiresAtRound})</span>
                  <button className="btn-danger" onClick={() => onRemoveEffect(effect.id)}>Remove</button>
                </div>
              ))}
              <label className="field">
                <span>New effect</span>
                <input type="text" value={effectLabel} onChange={(e) => setEffectLabel(e.target.value)} placeholder="Fireball, Difficult Terrain…" />
              </label>
              <label className="field">
                <span>Duration (rounds)</span>
                <input type="number" min={1} value={effectDuration} onChange={(e) => setEffectDuration(Number(e.target.value) || 1)} />
              </label>
              <button
                className="btn-secondary"
                onClick={() => {
                  if (!effectLabel.trim()) return;
                  onAddEffect(selectedZone.id, effectLabel.trim(), effectDuration);
                  setEffectLabel("");
                  setEffectDuration(1);
                }}
              >
                Add Effect
              </button>

              <div className="button-row">
                <button className="btn-danger" onClick={() => { onDeleteZone(selectedZone.id); setSelectedZoneId(null); }}>Delete Zone</button>
                <button className="btn-secondary" onClick={() => setSelectedZoneId(null)}>Close</button>
              </div>
            </>
          ) : (
            <>
              {selectedZone.tags.length > 0 && <p>{selectedZone.tags.join(" · ")}</p>}
              {linkedLocation && <LocationCardView location={linkedLocation} />}
              {selectedZone.hazard && <p>⚠ {selectedZone.hazard.label} ({selectedZone.hazard.damage} damage)</p>}
              {zoneEffects.filter((e) => e.zoneId === selectedZone.id).map((effect) => (
                <p key={effect.id}>{effect.label} (through round {effect.expiresAtRound})</p>
              ))}
              <button className="btn-secondary" onClick={() => setSelectedZoneId(null)}>Close</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
