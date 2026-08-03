import { useEffect, useState } from "react";
import type { Character } from "@spark/shared";
import { api, type WorldSummary } from "../api";
import { StatBlockView } from "../components/StatBlockView";
import { BackstoryView } from "../components/BackstoryView";

export function RosterPage({ worldFilter, onWorldFilterChange }: { worldFilter: string; onWorldFilterChange: (v: string) => void }) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [assignedWorld, setAssignedWorld] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  function refresh() {
    api.listCharacters(worldFilter || undefined).then(setCharacters).catch(() => {});
    api.listWorlds().then(setWorlds).catch(() => {});
  }

  useEffect(refresh, [worldFilter]);

  const selected = characters.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setNotes(selected.notes ?? "");
      setTags(selected.tags.join(", "));
      setAssignedWorld(selected.worldId ?? "");
    }
  }, [selected]);

  async function handleUpdate() {
    if (!selected) return;
    setStatus("saving");
    await api.updateCharacter(selected.id, {
      notes,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      worldId: assignedWorld || null,
    });
    setStatus("idle");
    refresh();
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`Delete ${selected.name}? This cannot be undone.`)) return;
    await api.deleteCharacter(selected.id);
    setSelectedId(null);
    refresh();
  }

  return (
    <div className="page roster-layout">
      <div className="panel roster-list">
        <label className="field">
          <span>Filter by world</span>
          <select value={worldFilter} onChange={(e) => onWorldFilterChange(e.target.value)}>
            <option value="">All</option>
            <option value="unassigned">Unassigned</option>
            {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>

        {characters.length === 0 && <p className="hint">No saved characters yet.</p>}
        <ul className="entity-list">
          {characters.map((c) => (
            <li key={c.id}>
              <button
                className={`entity-item ${c.id === selectedId ? "active" : ""}`}
                onClick={() => setSelectedId(c.id)}
              >
                <span className="entity-name">{c.name}</span>
                <span className="entity-meta">{c.kind === "npc" ? c.race : c.templateName} · CR {c.statBlock.challengeRating}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel result-panel">
        {!selected && <p className="hint">Select a character to view their stat block.</p>}
        {selected && (
          <>
            <StatBlockView
              name={selected.name}
              subtitle={`${selected.statBlock.size} ${selected.statBlock.creatureType}, ${selected.statBlock.alignment}${selected.race ? ` — ${selected.race}` : ""}${selected.background ? `, ${selected.background}` : ""}`}
              statBlock={selected.statBlock}
            />
            <BackstoryView backstory={selected.backstory} />

            <div className="save-panel">
              <h3 className="section-heading">Roster Details</h3>
              <label className="field">
                <span>World</span>
                <select value={assignedWorld} onChange={(e) => setAssignedWorld(e.target.value)}>
                  <option value="">Unassigned</option>
                  {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Tags</span>
                <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} />
              </label>
              <label className="field">
                <span>Notes</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </label>
              <div className="button-row">
                <button className="btn-primary" onClick={handleUpdate} disabled={status === "saving"}>
                  {status === "saving" ? "Saving…" : "Save Changes"}
                </button>
                <button className="btn-danger" onClick={handleDelete}>Delete</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
