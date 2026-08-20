import { useEffect, useRef, useState } from "react";
import type { Character, Location, Faction, QuestHook, EntityType } from "@spark/shared";
import { api } from "../api";
import { useActiveWorld } from "../ActiveWorldContext";
import { StatBlockView } from "../components/StatBlockView";
import { BackstoryView } from "../components/BackstoryView";
import { LocationCardView } from "../components/LocationCardView";
import { FactionCardView } from "../components/FactionCardView";
import { QuestHookCardView } from "../components/QuestHookCardView";
import { LinkedEntities } from "../components/LinkedEntities";
import { CodexNotesPanel } from "../components/CodexNotesPanel";
import { CodexIcon } from "../components/icons";
import { EmptyState } from "../components/EmptyState";
import { useScrollDetailOnSelect } from "../useScrollDetailOnSelect";

type CodexMode = "npcs" | "locations" | "factions" | "quests";

const MODE_LABELS: Record<CodexMode, string> = {
  npcs: "NPCs",
  locations: "Locations",
  factions: "Factions",
  quests: "Quests",
};

const MODE_TO_ENTITY_TYPE: Record<CodexMode, EntityType> = {
  npcs: "character",
  locations: "location",
  factions: "faction",
  quests: "quest",
};

export function CodexPage() {
  const { worlds, worldId, setWorldId } = useActiveWorld();
  const [mode, setMode] = useState<CodexMode>("npcs");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [quests, setQuests] = useState<QuestHook[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  useScrollDetailOnSelect(detailRef, selectedId);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!worldId) return;
    setLoading(true);
    setSelectedId(null);
    Promise.all([
      api.listCharacters(worldId),
      api.listLocations(worldId),
      api.listFactions(worldId),
      api.listQuests(worldId),
    ]).then(([c, l, f, q]) => {
      // The Codex is always the player's-eye-view, even for the world's
      // owner — it shows exactly what's been revealed, not a mix of
      // revealed and secret content depending on who's looking.
      setCharacters(c.filter((x) => !x.hiddenFromParty && x.kind === "npc"));
      setLocations(l.filter((x) => !x.hiddenFromParty));
      setFactions(f.filter((x) => !x.hiddenFromParty));
      setQuests(q.filter((x) => !x.hiddenFromParty));
    }).finally(() => setLoading(false));
  }, [worldId]);

  function switchMode(next: CodexMode) {
    setMode(next);
    setSelectedId(null);
  }

  const activeList = (
    mode === "npcs" ? characters.map((c) => ({ id: c.id, name: c.name, meta: c.race ?? "" })) :
    mode === "locations" ? locations.map((l) => ({ id: l.id, name: l.name, meta: `${l.category} · ${l.locationType}` })) :
    mode === "factions" ? factions.map((f) => ({ id: f.id, name: f.name, meta: f.factionType })) :
    quests.map((q) => ({ id: q.id, name: q.title, meta: `${q.questType} · ${q.tier}` }))
  );

  const selectedCharacter = mode === "npcs" ? characters.find((c) => c.id === selectedId) ?? null : null;
  const selectedLocation = mode === "locations" ? locations.find((l) => l.id === selectedId) ?? null : null;
  const selectedFaction = mode === "factions" ? factions.find((f) => f.id === selectedId) ?? null : null;
  const selectedQuest = mode === "quests" ? quests.find((q) => q.id === selectedId) ?? null : null;

  return (
    <div className="page roster-layout">
      <div className="panel roster-list">
        <div className="page-title">
          <CodexIcon className="page-title-icon" aria-hidden="true" />
          <h2>Codex</h2>
        </div>
        <p className="hint">What the party has learned so far — plus your own shared theories and notes.</p>

        {worlds.length === 0 ? (
          <p className="hint">Create or join a world to browse its codex.</p>
        ) : (
          <label className="field">
            <span>World</span>
            <select value={worldId} onChange={(e) => setWorldId(e.target.value)}>
              <option value="">Select a world…</option>
              {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
        )}

        {worldId && (
          <>
            <div className="tabs roster-mode-tabs">
              {(Object.keys(MODE_LABELS) as CodexMode[]).map((m) => (
                <button key={m} className={mode === m ? "active" : ""} aria-current={mode === m ? "true" : undefined} onClick={() => switchMode(m)}>{MODE_LABELS[m]}</button>
              ))}
            </div>

            {loading && <p className="hint">Loading…</p>}
            {!loading && activeList.length === 0 && <p className="hint">Nothing revealed yet.</p>}
            <ul className="entity-list">
              {activeList.map((entry) => (
                <li key={entry.id}>
                  <button
                    className={`entity-item ${entry.id === selectedId ? "active" : ""}`}
                    aria-current={entry.id === selectedId ? "true" : undefined}
                    onClick={() => setSelectedId(entry.id)}
                  >
                    <span className="entity-name">{entry.name}</span>
                    <span className="entity-meta">{entry.meta}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="panel result-panel" ref={detailRef}>
        {!selectedId && (
          <EmptyState
            icon={<CodexIcon />}
            heading={worldId ? "No entry selected" : "No world selected"}
            hint={worldId ? "Select an entry from the list to view its details." : "Select a world from the list to browse its codex."}
          />
        )}

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
        {selectedLocation && <LocationCardView location={selectedLocation} />}
        {selectedFaction && <FactionCardView faction={selectedFaction} />}
        {selectedQuest && <QuestHookCardView quest={selectedQuest} />}

        {selectedId && (
          <>
            <LinkedEntities type={MODE_TO_ENTITY_TYPE[mode]} id={selectedId} />
            <CodexNotesPanel worldId={worldId} entityType={MODE_TO_ENTITY_TYPE[mode]} entityId={selectedId} />
          </>
        )}
      </div>
    </div>
  );
}
