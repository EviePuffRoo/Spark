import { useState } from "react";
import type { SessionNote } from "@spark/shared";
import type { WorldSummary } from "../api";

function sortKey(note: SessionNote): number {
  return new Date(note.sessionDate ?? note.createdAt).getTime();
}

function formatDate(note: SessionNote): string {
  if (note.sessionDate) return new Date(note.sessionDate).toLocaleDateString(undefined, { timeZone: "UTC" });
  return new Date(note.createdAt).toLocaleDateString();
}

export function SessionTimelineView({
  notes, worlds, onSelectNote,
}: {
  notes: SessionNote[];
  worlds: WorldSummary[];
  onSelectNote: (note: SessionNote) => void;
}) {
  const [worldFilter, setWorldFilter] = useState("");

  const filtered = notes.filter((n) => !worldFilter || n.worldId === worldFilter);
  const sorted = [...filtered].sort((a, b) => sortKey(a) - sortKey(b));

  return (
    <div className="panel session-timeline">
      <h2>Session Timeline</h2>
      <p className="hint">The campaign's story so far, oldest to newest.</p>

      {worlds.length > 0 && (
        <label className="field">
          <span>Filter by world</span>
          <select value={worldFilter} onChange={(e) => setWorldFilter(e.target.value)}>
            <option value="">All</option>
            {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
      )}

      {sorted.length === 0 && <p className="hint">No session notes yet.</p>}

      <ul className="timeline-list">
        {sorted.map((note) => (
          <li key={note.id} className="timeline-entry">
            <button className="timeline-entry-button" onClick={() => onSelectNote(note)}>
              <span className="timeline-date">
                {formatDate(note)}{note.sessionLabel ? ` · ${note.sessionLabel}` : ""}
              </span>
              <span className="entity-name">{note.title}</span>
              <span className="timeline-summary">{note.summary}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
