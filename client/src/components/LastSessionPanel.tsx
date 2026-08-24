import { useEffect, useState } from "react";
import type { SessionNote } from "@spark/shared";
import { api } from "../api";

export function LastSessionPanel({ worldId, onOpenNotes }: { worldId: string; onOpenNotes?: () => void }) {
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.listSessionNotes(worldId).then(setNotes).catch(() => {}).finally(() => setLoading(false));
  }, [worldId]);

  const latestNote = notes.length > 0
    ? notes.reduce((a, b) => (new Date(a.sessionDate ?? a.createdAt) > new Date(b.sessionDate ?? b.createdAt) ? a : b))
    : null;

  return (
    <div className="panel last-session-panel">
      <h3 className="section-heading">Where We Left Off</h3>
      {loading && <p className="hint">Loading…</p>}
      {!loading && !latestNote && <p className="hint">No session notes for this world yet.</p>}
      {latestNote && (
        <>
          <p><strong>{latestNote.title}</strong>{latestNote.sessionLabel ? ` · ${latestNote.sessionLabel}` : ""}</p>
          <p>{latestNote.summary}</p>
          {latestNote.nextSteps && <p><strong>Next steps:</strong> {latestNote.nextSteps}</p>}
          {onOpenNotes && <button className="btn-secondary" onClick={onOpenNotes}>Open Notes</button>}
        </>
      )}
    </div>
  );
}
