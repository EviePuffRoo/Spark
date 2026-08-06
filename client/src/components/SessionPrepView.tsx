import { useEffect, useState } from "react";
import type { SessionNote, QuestHook, PlayerCharacter } from "@spark/shared";
import { api, type WorldSummary } from "../api";

export function SessionPrepView({
  worldId, setWorldId, worlds, notes, onSelectNote,
}: {
  worldId: string;
  setWorldId: (id: string) => void;
  worlds: WorldSummary[];
  notes: SessionNote[];
  onSelectNote: (note: SessionNote) => void;
}) {
  const [quests, setQuests] = useState<QuestHook[]>([]);
  const [playerCharacters, setPlayerCharacters] = useState<PlayerCharacter[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!worldId) {
      setQuests([]);
      setPlayerCharacters([]);
      return;
    }
    setLoading(true);
    Promise.all([api.listQuests(worldId), api.listPlayerCharacters(worldId)])
      .then(([q, p]) => { setQuests(q); setPlayerCharacters(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [worldId]);

  const worldNotes = notes.filter((n) => n.worldId === worldId);
  const latestNote = worldNotes.length > 0
    ? worldNotes.reduce((a, b) => (new Date(a.createdAt) > new Date(b.createdAt) ? a : b))
    : null;
  const activeQuests = quests.filter((q) => q.status === "active");

  return (
    <div className="generator-layout">
      <div className="panel">
        <h2>Session Prep</h2>
        <p className="hint">A quick briefing before you sit down to run the next session.</p>
        <label className="field">
          <span>World</span>
          <select value={worldId} onChange={(e) => setWorldId(e.target.value)}>
            <option value="">Select a world…</option>
            {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
      </div>

      {worldId && (
        <div className="panel result-panel">
          <h3 className="section-heading">Where We Left Off</h3>
          {!latestNote && <p className="hint">No session notes for this world yet.</p>}
          {latestNote && (
            <>
              <p><strong>{latestNote.title}</strong>{latestNote.sessionLabel ? ` — ${latestNote.sessionLabel}` : ""}</p>
              {latestNote.looseThreads && <p><strong>Loose threads:</strong> {latestNote.looseThreads}</p>}
              {latestNote.nextSteps && <p><strong>Next steps:</strong> {latestNote.nextSteps}</p>}
              <button className="btn-secondary" onClick={() => onSelectNote(latestNote)}>Open this note</button>
            </>
          )}

          <h3 className="section-heading">Open Threads</h3>
          {loading && <p className="hint">Loading…</p>}
          {!loading && activeQuests.length === 0 && <p className="hint">No active quests for this world.</p>}
          <ul className="entity-list">
            {activeQuests.map((q) => (
              <li key={q.id} className="world-row">
                <span className="entity-name">{q.title}</span>
                <span className="entity-meta">{q.hook}</span>
              </li>
            ))}
          </ul>

          <h3 className="section-heading">Party</h3>
          {!loading && playerCharacters.length === 0 && <p className="hint">No player characters for this world yet.</p>}
          <ul className="entity-list">
            {playerCharacters.map((pc) => (
              <li key={pc.id} className="world-row">
                <span className="entity-name">{pc.name}</span>
                <span className="entity-meta">Level {pc.level} {pc.race} {pc.className}{pc.playerName ? ` · ${pc.playerName}` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
