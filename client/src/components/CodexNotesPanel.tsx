import { useEffect, useState } from "react";
import type { CodexNote, EntityType } from "@spark/shared";
import { api } from "../api";
import { useAuth } from "../AuthContext";

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function CodexNotesPanel({
  worldId, entityType, entityId,
}: {
  worldId: string;
  entityType: EntityType;
  entityId: string;
}) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<CodexNote[]>([]);
  const [authorName, setAuthorName] = useState(user?.username ?? "");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.getCodexNotes(entityType, entityId).then(setNotes).catch((e) => setError(e.message));
  }

  useEffect(() => {
    setError(null);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  async function addNote() {
    if (!text.trim()) return;
    setError(null);
    try {
      await api.postCodexNote({
        worldId, entityType, entityId,
        authorName: authorName.trim() || user!.username,
        text: text.trim(),
      });
      setText("");
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="save-panel codex-notes-panel">
      <h3 className="section-heading">Party Notes</h3>
      <p className="hint">Shared theories and knowledge the whole party can see and add to.</p>

      {notes.length === 0 && <p className="hint">No notes yet — be the first.</p>}
      <ul className="dice-history">
        {notes.map((note) => (
          <li key={note.id} className="dice-history-row">
            <div className="dice-history-main">
              <span><strong>{note.authorName}:</strong> {note.text}</span>
            </div>
            <span className="dice-history-time">{timeAgo(note.createdAt)}</span>
          </li>
        ))}
      </ul>

      <label className="field">
        <span>Your name</span>
        <input type="text" value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder={user?.username} />
      </label>
      <label className="field">
        <span>Add a note</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="What do we know or suspect about this?" />
      </label>
      <button className="btn-secondary" onClick={addNote}>Add Note</button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
