import { useEffect, useState } from "react";
import type { DoomClock } from "@spark/shared";
import { api } from "../api";

const SIZE = 88;
const RADIUS = 38;
const CENTER = SIZE / 2;

function polarPoint(angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + RADIUS * Math.cos(rad), y: CENTER + RADIUS * Math.sin(rad) };
}

function wedgePath(startAngle: number, endAngle: number) {
  const start = polarPoint(startAngle);
  const end = polarPoint(endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function ClockFace({ clock }: { clock: DoomClock }) {
  const anglePer = 360 / clock.segments;
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="doom-clock-face" role="img" aria-label={`${clock.label}: ${clock.filled} of ${clock.segments} filled`}>
      {Array.from({ length: clock.segments }, (_, i) => (
        <path
          key={i}
          d={wedgePath(i * anglePer, (i + 1) * anglePer)}
          className={`doom-clock-wedge${i < clock.filled ? " filled" : ""}`}
        />
      ))}
      <circle cx={CENTER} cy={CENTER} r={RADIUS} className="doom-clock-outline" />
    </svg>
  );
}

// Full CRUD for the world's owner; a read-only face-and-label view (only
// ever the visibleToParty subset, per the GET route) for everyone else —
// same panel, the API response is what actually gates what's shown.
export function DoomClockPanel({ worldId, canEdit }: { worldId: string; canEdit: boolean }) {
  const [clocks, setClocks] = useState<DoomClock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newSegments, setNewSegments] = useState(6);
  const [newVisible, setNewVisible] = useState(false);

  function refresh() {
    setLoading(true);
    api.listDoomClocks(worldId).then(setClocks).catch((e) => setError((e as Error).message)).finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId]);

  async function createClock() {
    if (!newLabel.trim()) return;
    try {
      await api.createDoomClock({ worldId, label: newLabel.trim(), segments: newSegments, visibleToParty: newVisible });
      setNewLabel("");
      setNewSegments(6);
      setNewVisible(false);
      setCreating(false);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function advance(id: string, amount: number) {
    try {
      await api.advanceDoomClock(id, amount);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function reset(id: string) {
    try {
      await api.resetDoomClock(id);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function toggleVisible(clock: DoomClock) {
    try {
      await api.updateDoomClock(clock.id, { visibleToParty: !clock.visibleToParty });
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteDoomClock(id);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!canEdit && !loading && clocks.length === 0) return null;

  return (
    <div className="panel doom-clock-panel">
      <h3 className="section-heading">Doom Clocks</h3>
      {loading && <p className="hint">Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && clocks.length === 0 && canEdit && <p className="hint">No clocks running yet.</p>}

      <ul className="doom-clock-list">
        {clocks.map((clock) => (
          <li key={clock.id} className="doom-clock-row">
            <ClockFace clock={clock} />
            <div className="doom-clock-info">
              <span className="entity-name">{clock.label}</span>
              <span className="entity-meta">{clock.filled} / {clock.segments}{clock.visibleToParty ? " · Visible to party" : ""}</span>
              {canEdit && (
                <div className="button-row">
                  <button className="btn-secondary" onClick={() => advance(clock.id, 1)} disabled={clock.filled >= clock.segments}>+1</button>
                  <button className="btn-secondary" onClick={() => advance(clock.id, -1)} disabled={clock.filled <= 0}>-1</button>
                  <button className="btn-secondary" onClick={() => reset(clock.id)} disabled={clock.filled === 0}>Reset</button>
                  <button className="btn-secondary" onClick={() => toggleVisible(clock)}>
                    {clock.visibleToParty ? "Hide from Party" : "Show to Party"}
                  </button>
                  <button className="btn-danger" onClick={() => remove(clock.id)}>Delete</button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {canEdit && (
        creating ? (
          <div className="save-panel">
            <label className="field">
              <span>Label</span>
              <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. The Ritual Completes" />
            </label>
            <label className="field">
              <span>Segments</span>
              <input type="number" min={2} max={20} value={newSegments} onChange={(e) => setNewSegments(Number(e.target.value) || 2)} />
            </label>
            <label className="field">
              <input type="checkbox" checked={newVisible} onChange={(e) => setNewVisible(e.target.checked)} />
              {" "}Visible to party
            </label>
            <div className="button-row">
              <button className="btn-primary" onClick={createClock}>Create Clock</button>
              <button className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn-secondary" onClick={() => setCreating(true)}>+ New Doom Clock</button>
        )
      )}
    </div>
  );
}
