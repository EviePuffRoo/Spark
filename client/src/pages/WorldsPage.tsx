import { useEffect, useState } from "react";
import { api, type WorldSummary } from "../api";

function summarizeCounts(w: WorldSummary): string {
  const parts: [number, string][] = [
    [w.characterCount, "character"],
    [w.itemCount, "item"],
    [w.locationCount, "location"],
    [w.questCount, "quest"],
    [w.factionCount, "faction"],
    [w.encounterTableCount, "encounter table"],
    [w.sessionNoteCount, "session note"],
  ];
  const nonEmpty = parts.filter(([count]) => count > 0);
  if (nonEmpty.length === 0) return "Empty so far";
  return nonEmpty.map(([count, label]) => `${count} ${label}${count === 1 ? "" : "s"}`).join(" · ");
}

export function WorldsPage({ onViewRoster }: { onViewRoster: (worldId: string) => void }) {
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.listWorlds().then(setWorlds).catch((e) => setError(e.message));
  }

  useEffect(refresh, []);

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      await api.createWorld(name.trim(), description.trim() || undefined);
      setName("");
      setDescription("");
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this world? Its characters will become unassigned, not deleted.")) return;
    await api.deleteWorld(id);
    refresh();
  }

  return (
    <div className="page">
      <div className="panel">
        <h2>Worlds &amp; Campaigns</h2>
        <p className="hint">Group everything you create into worlds or campaigns as you build them out.</p>

        <div className="save-panel">
          <label className="field">
            <span>New world name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="The Sunken Coast" />
          </label>
          <label className="field">
            <span>Description (optional)</span>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <button className="btn-primary" onClick={handleCreate}>Create World</button>
        </div>
        {error && <p className="error">{error}</p>}

        <ul className="entity-list world-list">
          {worlds.map((w) => (
            <li key={w.id} className="world-row">
              <div>
                <div className="entity-name">{w.name}</div>
                {w.description && <div className="entity-meta">{w.description}</div>}
                <div className="entity-meta">{summarizeCounts(w)}</div>
              </div>
              <div className="button-row">
                <button className="btn-secondary" onClick={() => onViewRoster(w.id)}>View Roster</button>
                <button className="btn-danger" onClick={() => handleDelete(w.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
        {worlds.length === 0 && <p className="hint">No worlds yet — create one above.</p>}
      </div>
    </div>
  );
}
