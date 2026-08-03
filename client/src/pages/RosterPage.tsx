import { useEffect, useState } from "react";
import type { Character, Item, Location, QuestHook, Faction, EncounterTable, SessionNote } from "@spark/shared";
import { api, type WorldSummary } from "../api";
import { StatBlockView } from "../components/StatBlockView";
import { BackstoryView } from "../components/BackstoryView";
import { ItemCardView } from "../components/ItemCardView";
import { LocationCardView } from "../components/LocationCardView";
import { QuestHookCardView } from "../components/QuestHookCardView";
import { FactionCardView } from "../components/FactionCardView";
import { EncounterTableCardView } from "../components/EncounterTableCardView";

type Mode = "characters" | "items" | "locations" | "quests" | "factions" | "encounters" | "notes";

const MODE_LABELS: Record<Mode, string> = {
  characters: "Characters",
  items: "Items",
  locations: "Locations",
  quests: "Quests",
  factions: "Factions",
  encounters: "Encounters",
  notes: "Notes",
};

export function RosterPage({ worldFilter, onWorldFilterChange }: { worldFilter: string; onWorldFilterChange: (v: string) => void }) {
  const [mode, setMode] = useState<Mode>("characters");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [quests, setQuests] = useState<QuestHook[]>([]);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [encounters, setEncounters] = useState<EncounterTable[]>([]);
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [metaNotes, setMetaNotes] = useState("");
  const [tags, setTags] = useState("");
  const [assignedWorld, setAssignedWorld] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  function refresh() {
    const w = worldFilter || undefined;
    api.listCharacters(w).then(setCharacters).catch(() => {});
    api.listItems(w).then(setItems).catch(() => {});
    api.listLocations(w).then(setLocations).catch(() => {});
    api.listQuests(w).then(setQuests).catch(() => {});
    api.listFactions(w).then(setFactions).catch(() => {});
    api.listEncounterTables(w).then(setEncounters).catch(() => {});
    api.listSessionNotes(w).then(setNotes).catch(() => {});
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
  const selectedFaction = mode === "factions" ? factions.find((f) => f.id === selectedId) ?? null : null;
  const selectedEncounter = mode === "encounters" ? encounters.find((e) => e.id === selectedId) ?? null : null;
  const selectedNote = mode === "notes" ? notes.find((n) => n.id === selectedId) ?? null : null;
  const selected = selectedCharacter ?? selectedItem ?? selectedLocation ?? selectedQuest ?? selectedFaction ?? selectedEncounter ?? selectedNote;
  const selectedDisplayName =
    selectedCharacter?.name ?? selectedItem?.name ?? selectedLocation?.name ?? selectedQuest?.title ??
    selectedFaction?.name ?? selectedEncounter?.name ?? selectedNote?.title ?? "";

  useEffect(() => {
    if (selected) {
      setMetaNotes(selected.notes ?? "");
      setTags(selected.tags.join(", "));
      setAssignedWorld(selected.worldId ?? "");
    }
  }, [selected]);

  async function handleUpdate() {
    if (!selected) return;
    setStatus("saving");
    const patch = { notes: metaNotes, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), worldId: assignedWorld || null };
    if (mode === "characters") await api.updateCharacter(selected.id, patch);
    else if (mode === "items") await api.updateItem(selected.id, patch);
    else if (mode === "locations") await api.updateLocation(selected.id, patch);
    else if (mode === "quests") await api.updateQuest(selected.id, patch);
    else if (mode === "factions") await api.updateFaction(selected.id, patch);
    else if (mode === "encounters") await api.updateEncounterTable(selected.id, patch);
    else await api.updateSessionNote(selected.id, patch);
    setStatus("idle");
    refresh();
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`Delete ${selectedDisplayName}? This cannot be undone.`)) return;
    if (mode === "characters") await api.deleteCharacter(selected.id);
    else if (mode === "items") await api.deleteItem(selected.id);
    else if (mode === "locations") await api.deleteLocation(selected.id);
    else if (mode === "quests") await api.deleteQuest(selected.id);
    else if (mode === "factions") await api.deleteFaction(selected.id);
    else if (mode === "encounters") await api.deleteEncounterTable(selected.id);
    else await api.deleteSessionNote(selected.id);
    setSelectedId(null);
    refresh();
  }

  const activeList =
    mode === "characters" ? characters.map((c) => ({ id: c.id, name: c.name, meta: `${c.kind === "npc" ? c.race : c.templateName} · CR ${c.statBlock.challengeRating}` })) :
    mode === "items" ? items.map((i) => ({ id: i.id, name: i.name, meta: `${i.category} · ${i.rarity}` })) :
    mode === "locations" ? locations.map((l) => ({ id: l.id, name: l.name, meta: `${l.category} · ${l.locationType}` })) :
    mode === "quests" ? quests.map((q) => ({ id: q.id, name: q.title, meta: `${q.questType} · ${q.tier}` })) :
    mode === "factions" ? factions.map((f) => ({ id: f.id, name: f.name, meta: f.factionType })) :
    mode === "encounters" ? encounters.map((e) => ({ id: e.id, name: e.name, meta: `${e.terrain} · d${e.entries.length}` })) :
    notes.map((n) => ({ id: n.id, name: n.title, meta: n.sessionLabel || new Date(n.createdAt).toLocaleDateString() }));

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
        {!selected && <p className="hint">Select an entry to view details.</p>}
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
        {selectedFaction && <FactionCardView faction={selectedFaction} />}
        {selectedEncounter && <EncounterTableCardView table={selectedEncounter} />}
        {selectedNote && (
          <div className="statblock item-card">
            <h2 className="statblock-name">{selectedNote.title}</h2>
            {selectedNote.sessionLabel && <p className="statblock-subtitle">{selectedNote.sessionLabel}</p>}
            <hr className="rule gold" />
            <h3 className="section-heading">Summary</h3>
            <p>{selectedNote.summary}</p>
            {selectedNote.looseThreads && <><h3 className="section-heading">Loose Threads</h3><p>{selectedNote.looseThreads}</p></>}
            {selectedNote.nextSteps && <><h3 className="section-heading">Next Steps</h3><p>{selectedNote.nextSteps}</p></>}
          </div>
        )}

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
              <textarea value={metaNotes} onChange={(e) => setMetaNotes(e.target.value)} rows={3} />
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
