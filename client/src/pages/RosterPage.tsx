import { useEffect, useState } from "react";
import type { Character, Item, Location, QuestHook, Faction, EncounterTable, SessionNote, EntityType } from "@spark/shared";
import { api, type WorldSummary } from "../api";
import { StatBlockView } from "../components/StatBlockView";
import { BackstoryView } from "../components/BackstoryView";
import { ItemCardView } from "../components/ItemCardView";
import { LocationCardView } from "../components/LocationCardView";
import { QuestHookCardView } from "../components/QuestHookCardView";
import { FactionCardView } from "../components/FactionCardView";
import { EncounterTableCardView } from "../components/EncounterTableCardView";
import { LinkedEntities } from "../components/LinkedEntities";
import { SessionNoteCardView } from "../components/SessionNoteCardView";
import type { PrintItem } from "../components/PrintPane";
import { CharacterEditor } from "../components/CharacterEditor";
import { ItemEditor } from "../components/ItemEditor";
import { LocationEditor } from "../components/LocationEditor";
import { QuestEditor } from "../components/QuestEditor";
import { FactionEditor } from "../components/FactionEditor";
import { EncounterTableEditor } from "../components/EncounterTableEditor";

export type Mode = "characters" | "items" | "locations" | "quests" | "factions" | "encounters" | "notes";

const MODE_LABELS: Record<Mode, string> = {
  characters: "Characters",
  items: "Items",
  locations: "Locations",
  quests: "Quests",
  factions: "Factions",
  encounters: "Encounters",
  notes: "Notes",
};

export const ENTITY_TYPE_TO_MODE: Record<EntityType, Mode> = {
  character: "characters",
  item: "items",
  location: "locations",
  quest: "quests",
  faction: "factions",
  encounterTable: "encounters",
  sessionNote: "notes",
};

const MODE_TO_ENTITY_TYPE: Record<Mode, EntityType> = {
  characters: "character",
  items: "item",
  locations: "location",
  quests: "quest",
  factions: "faction",
  encounters: "encounterTable",
  notes: "sessionNote",
};

export interface RosterSelection {
  type: EntityType;
  id: string;
}

async function fetchPrintItem(type: EntityType, id: string): Promise<PrintItem | null> {
  switch (type) {
    case "character": return { type, data: await api.getCharacter(id) };
    case "item": return { type, data: await api.getItem(id) };
    case "location": return { type, data: await api.getLocation(id) };
    case "quest": return { type, data: await api.getQuest(id) };
    case "faction": return { type, data: await api.getFaction(id) };
    case "encounterTable": return { type, data: await api.getEncounterTable(id) };
    case "sessionNote": return { type, data: await api.getSessionNote(id) };
    default: return null;
  }
}

export function RosterPage({
  worldFilter, onWorldFilterChange, pendingSelection, onConsumeSelection, onPrint,
}: {
  worldFilter: string;
  onWorldFilterChange: (v: string) => void;
  pendingSelection?: RosterSelection | null;
  onConsumeSelection?: () => void;
  onPrint?: (items: PrintItem[]) => void;
}) {
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
  const [editingContent, setEditingContent] = useState(false);
  const [loading, setLoading] = useState(true);

  function refresh() {
    const w = worldFilter || undefined;
    setLoading(true);
    Promise.all([
      api.listCharacters(w).then(setCharacters).catch(() => {}),
      api.listItems(w).then(setItems).catch(() => {}),
      api.listLocations(w).then(setLocations).catch(() => {}),
      api.listQuests(w).then(setQuests).catch(() => {}),
      api.listFactions(w).then(setFactions).catch(() => {}),
      api.listEncounterTables(w).then(setEncounters).catch(() => {}),
      api.listSessionNotes(w).then(setNotes).catch(() => {}),
      api.listWorlds().then(setWorlds).catch(() => {}),
    ]).finally(() => setLoading(false));
  }

  useEffect(refresh, [worldFilter]);

  // If the world currently selected in the filter gets deleted elsewhere, the
  // dropdown falls back to displaying "All" (no matching <option> anymore),
  // but the filter itself would silently stay pointed at the dead world's id
  // unless we reset it - showing zero results instead of actually falling
  // back to "All".
  useEffect(() => {
    if (loading) return;
    if (!worldFilter || worldFilter === "unassigned") return;
    if (!worlds.some((w) => w.id === worldFilter)) {
      onWorldFilterChange("");
    }
  }, [loading, worlds, worldFilter, onWorldFilterChange]);

  useEffect(() => {
    if (!pendingSelection) return;
    setMode(ENTITY_TYPE_TO_MODE[pendingSelection.type]);
    if (worldFilter) onWorldFilterChange("");
    setSelectedId(pendingSelection.id);
    onConsumeSelection?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSelection]);

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
    setEditingContent(false);
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

  async function handleDuplicate() {
    if (!selected) return;
    setStatus("saving");
    const worldId = selected.worldId ?? null;
    const tagsCopy = [...selected.tags];
    const notesCopy = selected.notes;
    let created: { id: string } | null = null;
    if (selectedCharacter) {
      created = await api.saveCharacter({
        kind: selectedCharacter.kind, name: `${selectedCharacter.name} (Copy)`, race: selectedCharacter.race,
        background: selectedCharacter.background, alignment: selectedCharacter.alignment,
        templateId: selectedCharacter.templateId, templateName: selectedCharacter.templateName,
        statBlock: selectedCharacter.statBlock, backstory: selectedCharacter.backstory,
        worldId, tags: tagsCopy, notes: notesCopy,
      });
    } else if (selectedItem) {
      created = await api.saveItem({
        name: `${selectedItem.name} (Copy)`, itemType: selectedItem.itemType, category: selectedItem.category,
        rarity: selectedItem.rarity, description: selectedItem.description, property: selectedItem.property,
        history: selectedItem.history, worldId, tags: tagsCopy, notes: notesCopy,
      });
    } else if (selectedLocation) {
      created = await api.saveLocation({
        name: `${selectedLocation.name} (Copy)`, locationType: selectedLocation.locationType, category: selectedLocation.category,
        description: selectedLocation.description, notableFeature: selectedLocation.notableFeature,
        keeper: selectedLocation.keeper, rumor: selectedLocation.rumor, worldId, tags: tagsCopy, notes: notesCopy,
      });
    } else if (selectedQuest) {
      created = await api.saveQuest({
        title: `${selectedQuest.title} (Copy)`, questType: selectedQuest.questType, tier: selectedQuest.tier,
        hook: selectedQuest.hook, objective: selectedQuest.objective, complication: selectedQuest.complication,
        reward: selectedQuest.reward, worldId, tags: tagsCopy, notes: notesCopy,
      });
    } else if (selectedFaction) {
      created = await api.saveFaction({
        name: `${selectedFaction.name} (Copy)`, factionType: selectedFaction.factionType, agenda: selectedFaction.agenda,
        methods: selectedFaction.methods, publicFace: selectedFaction.publicFace, hook: selectedFaction.hook,
        worldId, tags: tagsCopy, notes: notesCopy,
      });
    } else if (selectedEncounter) {
      created = await api.saveEncounterTable({
        name: `${selectedEncounter.name} (Copy)`, terrain: selectedEncounter.terrain, entries: selectedEncounter.entries,
        worldId, tags: tagsCopy, notes: notesCopy,
      });
    } else if (selectedNote) {
      created = await api.saveSessionNote({
        title: `${selectedNote.title} (Copy)`, sessionLabel: selectedNote.sessionLabel, summary: selectedNote.summary,
        looseThreads: selectedNote.looseThreads, nextSteps: selectedNote.nextSteps, worldId, tags: tagsCopy, notes: notesCopy,
      });
    }
    setStatus("idle");
    refresh();
    if (created) setSelectedId(created.id);
  }

  function handlePrint() {
    if (!onPrint) return;
    if (selectedCharacter) onPrint([{ type: "character", data: selectedCharacter }]);
    else if (selectedItem) onPrint([{ type: "item", data: selectedItem }]);
    else if (selectedLocation) onPrint([{ type: "location", data: selectedLocation }]);
    else if (selectedQuest) onPrint([{ type: "quest", data: selectedQuest }]);
    else if (selectedFaction) onPrint([{ type: "faction", data: selectedFaction }]);
    else if (selectedEncounter) onPrint([{ type: "encounterTable", data: selectedEncounter }]);
    else if (selectedNote) onPrint([{ type: "sessionNote", data: selectedNote }]);
  }

  async function handlePrintSessionPack() {
    if (!selectedNote || !onPrint) return;
    const links = await api.getLinks("sessionNote", selectedNote.id);
    const linkedItems = await Promise.all(links.map((l) => fetchPrintItem(l.other.type, l.other.id)));
    const items: PrintItem[] = [
      { type: "sessionNote", data: selectedNote },
      ...linkedItems.filter((i): i is PrintItem => i !== null),
    ];
    onPrint(items);
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

        {loading && <p className="hint">Loading…</p>}
        {!loading && activeList.length === 0 && <p className="hint">No saved {MODE_LABELS[mode].toLowerCase()} yet.</p>}
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

        {selected && editingContent && <h2>Editing {selectedDisplayName}</h2>}

        {selectedCharacter && !editingContent && (
          <>
            <StatBlockView
              name={selectedCharacter.name}
              subtitle={`${selectedCharacter.statBlock.size} ${selectedCharacter.statBlock.creatureType}, ${selectedCharacter.statBlock.alignment}${selectedCharacter.race ? ` — ${selectedCharacter.race}` : ""}${selectedCharacter.background ? `, ${selectedCharacter.background}` : ""}`}
              statBlock={selectedCharacter.statBlock}
            />
            <BackstoryView backstory={selectedCharacter.backstory} />
          </>
        )}
        {selectedCharacter && editingContent && (
          <CharacterEditor
            character={selectedCharacter}
            onSave={async (patch) => { await api.updateCharacter(selectedCharacter.id, patch); setEditingContent(false); refresh(); }}
            onCancel={() => setEditingContent(false)}
          />
        )}

        {selectedItem && !editingContent && <ItemCardView item={selectedItem} />}
        {selectedItem && editingContent && (
          <ItemEditor
            value={selectedItem}
            onSave={async (patch) => { await api.updateItem(selectedItem.id, patch); setEditingContent(false); refresh(); }}
            onCancel={() => setEditingContent(false)}
          />
        )}

        {selectedLocation && !editingContent && <LocationCardView location={selectedLocation} />}
        {selectedLocation && editingContent && (
          <LocationEditor
            value={selectedLocation}
            onSave={async (patch) => { await api.updateLocation(selectedLocation.id, patch); setEditingContent(false); refresh(); }}
            onCancel={() => setEditingContent(false)}
          />
        )}

        {selectedQuest && !editingContent && <QuestHookCardView quest={selectedQuest} />}
        {selectedQuest && editingContent && (
          <QuestEditor
            value={selectedQuest}
            onSave={async (patch) => { await api.updateQuest(selectedQuest.id, patch); setEditingContent(false); refresh(); }}
            onCancel={() => setEditingContent(false)}
          />
        )}

        {selectedFaction && !editingContent && <FactionCardView faction={selectedFaction} />}
        {selectedFaction && editingContent && (
          <FactionEditor
            value={selectedFaction}
            onSave={async (patch) => { await api.updateFaction(selectedFaction.id, patch); setEditingContent(false); refresh(); }}
            onCancel={() => setEditingContent(false)}
          />
        )}

        {selectedEncounter && !editingContent && <EncounterTableCardView table={selectedEncounter} />}
        {selectedEncounter && editingContent && (
          <EncounterTableEditor
            value={selectedEncounter}
            onSave={async (patch) => { await api.updateEncounterTable(selectedEncounter.id, patch); setEditingContent(false); refresh(); }}
            onCancel={() => setEditingContent(false)}
          />
        )}

        {selectedNote && (
          <>
            <SessionNoteCardView note={selectedNote} />
            <p className="hint">Edit this note from the Notes tab.</p>
          </>
        )}

        {selected && !editingContent && mode !== "notes" && (
          <button className="btn-secondary" onClick={() => setEditingContent(true)}>Edit Content</button>
        )}

        {selected && !editingContent && onPrint && (
          <button className="btn-secondary" onClick={handlePrint}>Print</button>
        )}
        {selected && !editingContent && onPrint && mode === "notes" && (
          <button className="btn-secondary" onClick={handlePrintSessionPack}>Print Session Pack</button>
        )}

        {selected && !editingContent && (
          <>
            <LinkedEntities type={MODE_TO_ENTITY_TYPE[mode]} id={selected.id} />

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
                <button className="btn-secondary" onClick={handleDuplicate} disabled={status === "saving"}>Duplicate</button>
                <button className="btn-danger" onClick={handleDelete}>Delete</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
