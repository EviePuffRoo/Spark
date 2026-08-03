import { useEffect, useState } from "react";
import type { Character, Item } from "@spark/shared";
import { api, type WorldSummary } from "../api";
import { StatBlockView } from "../components/StatBlockView";
import { BackstoryView } from "../components/BackstoryView";
import { ItemCardView } from "../components/ItemCardView";

type Mode = "characters" | "items";

export function RosterPage({ worldFilter, onWorldFilterChange }: { worldFilter: string; onWorldFilterChange: (v: string) => void }) {
  const [mode, setMode] = useState<Mode>("characters");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [assignedWorld, setAssignedWorld] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  function refresh() {
    api.listCharacters(worldFilter || undefined).then(setCharacters).catch(() => {});
    api.listItems(worldFilter || undefined).then(setItems).catch(() => {});
    api.listWorlds().then(setWorlds).catch(() => {});
  }

  useEffect(refresh, [worldFilter]);

  function switchMode(next: Mode) {
    setMode(next);
    setSelectedId(null);
  }

  const selectedCharacter = mode === "characters" ? characters.find((c) => c.id === selectedId) ?? null : null;
  const selectedItem = mode === "items" ? items.find((i) => i.id === selectedId) ?? null : null;
  const selected = selectedCharacter ?? selectedItem;

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
    const patch = { notes, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), worldId: assignedWorld || null };
    if (mode === "characters") await api.updateCharacter(selected.id, patch);
    else await api.updateItem(selected.id, patch);
    setStatus("idle");
    refresh();
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`Delete ${selected.name}? This cannot be undone.`)) return;
    if (mode === "characters") await api.deleteCharacter(selected.id);
    else await api.deleteItem(selected.id);
    setSelectedId(null);
    refresh();
  }

  return (
    <div className="page roster-layout">
      <div className="panel roster-list">
        <div className="tabs roster-mode-tabs">
          <button className={mode === "characters" ? "active" : ""} onClick={() => switchMode("characters")}>Characters</button>
          <button className={mode === "items" ? "active" : ""} onClick={() => switchMode("items")}>Items</button>
        </div>

        <label className="field">
          <span>Filter by world</span>
          <select value={worldFilter} onChange={(e) => onWorldFilterChange(e.target.value)}>
            <option value="">All</option>
            <option value="unassigned">Unassigned</option>
            {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>

        {mode === "characters" && (
          <>
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
          </>
        )}

        {mode === "items" && (
          <>
            {items.length === 0 && <p className="hint">No saved items yet.</p>}
            <ul className="entity-list">
              {items.map((i) => (
                <li key={i.id}>
                  <button
                    className={`entity-item ${i.id === selectedId ? "active" : ""}`}
                    onClick={() => setSelectedId(i.id)}
                  >
                    <span className="entity-name">{i.name}</span>
                    <span className="entity-meta">{i.category} · {i.rarity}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="panel result-panel">
        {!selected && <p className="hint">Select a {mode === "characters" ? "character" : "item"} to view details.</p>}
        {selectedCharacter && (
          <>
            <StatBlockView
              name={selectedCharacter.name}
              subtitle={`${selectedCharacter.statBlock.size} ${selectedCharacter.statBlock.creatureType}, ${selectedCharacter.statBlock.alignment}${selectedCharacter.race ? ` — ${selectedCharacter.race}` : ""}${selectedCharacter.background ? `, ${selectedCharacter.background}` : ""}`}
              statBlock={selectedCharacter.statBlock}
            />
            <BackstoryView backstory={selectedCharacter.backstory} />
          </>
        )}
        {selectedItem && <ItemCardView item={selectedItem} />}

        {selected && (
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
        )}
      </div>
    </div>
  );
}
