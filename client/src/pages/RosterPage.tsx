import { useEffect, useState } from "react";
import type { Character, Item, Location, QuestHook } from "@spark/shared";
import { api, type WorldSummary } from "../api";
import { StatBlockView } from "../components/StatBlockView";
import { BackstoryView } from "../components/BackstoryView";
import { ItemCardView } from "../components/ItemCardView";
import { LocationCardView } from "../components/LocationCardView";
import { QuestHookCardView } from "../components/QuestHookCardView";

type Mode = "characters" | "items" | "locations" | "quests";

const MODE_LABELS: Record<Mode, string> = {
  characters: "Characters",
  items: "Items",
  locations: "Locations",
  quests: "Quests",
};

export function RosterPage({ worldFilter, onWorldFilterChange }: { worldFilter: string; onWorldFilterChange: (v: string) => void }) {
  const [mode, setMode] = useState<Mode>("characters");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [quests, setQuests] = useState<QuestHook[]>([]);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [assignedWorld, setAssignedWorld] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  function refresh() {
    api.listCharacters(worldFilter || undefined).then(setCharacters).catch(() => {});
    api.listItems(worldFilter || undefined).then(setItems).catch(() => {});
    api.listLocations(worldFilter || undefined).then(setLocations).catch(() => {});
    api.listQuests(worldFilter || undefined).then(setQuests).catch(() => {});
    api.listWorlds().then(setWorlds).catch(() => {});
  }

  useEffect(refresh, [worldFilter]);

  function switchMode(next: Mode) {
    setMode(next);
    setSelectedId(null);
  }

  const selectedCharacter = mode === "characters" ? characters.find((c) => c.id === selectedId) ?? null : null;
  const selectedItem = mode === "items" ? items.find((i) => i.id === selectedId) ?? null : null;
  const selectedLocation = mode === "locations" ? locations.find((l) => l.id === selectedId) ?? null : null;
  const selectedQuest = mode === "quests" ? quests.find((q) => q.id === selectedId) ?? null : null;
  const selected = selectedCharacter ?? selectedItem ?? selectedLocation ?? selectedQuest;
  const selectedDisplayName = selectedCharacter?.name ?? selectedItem?.name ?? selectedLocation?.name ?? selectedQuest?.title ?? "";

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
    else if (mode === "items") await api.updateItem(selected.id, patch);
    else if (mode === "locations") await api.updateLocation(selected.id, patch);
    else await api.updateQuest(selected.id, patch);
    setStatus("idle");
    refresh();
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`Delete ${selectedDisplayName}? This cannot be undone.`)) return;
    if (mode === "characters") await api.deleteCharacter(selected.id);
    else if (mode === "items") await api.deleteItem(selected.id);
    else if (mode === "locations") await api.deleteLocation(selected.id);
    else await api.deleteQuest(selected.id);
    setSelectedId(null);
    refresh();
  }

  const activeList =
    mode === "characters" ? characters.map((c) => ({ id: c.id, name: c.name, meta: `${c.kind === "npc" ? c.race : c.templateName} · CR ${c.statBlock.challengeRating}` })) :
    mode === "items" ? items.map((i) => ({ id: i.id, name: i.name, meta: `${i.category} · ${i.rarity}` })) :
    mode === "locations" ? locations.map((l) => ({ id: l.id, name: l.name, meta: `${l.category} · ${l.locationType}` })) :
    quests.map((q) => ({ id: q.id, name: q.title, meta: `${q.questType} · ${q.tier}` }));

  return (
    <div className="page roster-layout">
      <div className="panel roster-list">
        <div className="tabs roster-mode-tabs">
          {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
            <button key={m} className={mode === m ? "active" : ""} onClick={() => switchMode(m)}>{MODE_LABELS[m]}</button>
          ))}
        </div>

        <label className="field">
          <span>Filter by world</span>
          <select value={worldFilter} onChange={(e) => onWorldFilterChange(e.target.value)}>
            <option value="">All</option>
            <option value="unassigned">Unassigned</option>
            {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>

        {activeList.length === 0 && <p className="hint">No saved {MODE_LABELS[mode].toLowerCase()} yet.</p>}
        <ul className="entity-list">
          {activeList.map((entry) => (
            <li key={entry.id}>
              <button
                className={`entity-item ${entry.id === selectedId ? "active" : ""}`}
                onClick={() => setSelectedId(entry.id)}
              >
                <span className="entity-name">{entry.name}</span>
                <span className="entity-meta">{entry.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel result-panel">
        {!selected && <p className="hint">Select a {mode === "characters" ? "character" : mode.slice(0, -1)} to view details.</p>}
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
        {selectedLocation && <LocationCardView location={selectedLocation} />}
        {selectedQuest && <QuestHookCardView quest={selectedQuest} />}

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
