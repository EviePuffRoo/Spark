import { useEffect, useState } from "react";
import { api, type WorldSummary } from "../api";

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
        <p className="hint">Group your NPCs, monsters, items, locations, and quest hooks into worlds or campaigns as you build them out.</p>

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
                <div className="entity-meta">
                  {w.characterCount} character{w.characterCount === 1 ? "" : "s"} &middot; {w.itemCount} item{w.itemCount === 1 ? "" : "s"}
                  {" "}&middot; {w.locationCount} location{w.locationCount === 1 ? "" : "s"} &middot; {w.questCount} quest{w.questCount === 1 ? "" : "s"}
                </div>
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
