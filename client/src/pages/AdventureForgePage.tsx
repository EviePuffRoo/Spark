import { useState } from "react";
import type {
  EntityType, AdventureCastNames, GeneratedAdventure,
  GeneratedCharacter, GeneratedLocation, GeneratedItem, GeneratedEncounterTable,
} from "@spark/shared";
import { api } from "../api";
import { useActiveWorld } from "../ActiveWorldContext";
import { AdventureCardView } from "../components/AdventureCardView";
import { EntitySearchPicker } from "../components/EntitySearchPicker";
import { SaveEntityFields } from "../components/SaveEntityFields";

type RoleSlot<T> = { kind: "new"; data: T } | { kind: "existing"; id: string; name: string };

function slotName<T extends { name: string }>(slot: RoleSlot<T> | null): string | undefined {
  if (!slot) return undefined;
  return slot.kind === "new" ? slot.data.name : slot.name;
}

async function persistSlot<T>(
  slot: RoleSlot<T> | null,
  saveFn: (data: T, worldId: string | null) => Promise<{ id: string }>,
  worldId: string | null
): Promise<string | null> {
  if (!slot) return null;
  if (slot.kind === "existing") return slot.id;
  const saved = await saveFn(slot.data, worldId);
  return saved.id;
}

function RoleSlotPicker<T extends { name: string }>({
  label, entityType, generate, value, onChange, optional,
}: {
  label: string;
  entityType: EntityType;
  generate: () => Promise<T>;
  value: RoleSlot<T> | null;
  onChange: (v: RoleSlot<T> | null) => void;
  optional?: boolean;
}) {
  const [generating, setGenerating] = useState(false);
  const [pickingExisting, setPickingExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerateNew() {
    setGenerating(true);
    setError(null);
    try {
      const data = await generate();
      onChange({ kind: "new", data });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="role-slot">
      <span className="role-slot-label">
        {label}
        {optional && <em className="role-slot-optional"> (optional)</em>}
      </span>

      {value && (
        <div className="role-slot-filled">
          <span className="role-slot-value">
            {slotName(value)}
            {value.kind === "new" && <em> (new)</em>}
          </span>
          <button className="btn-secondary" onClick={() => onChange(null)}>Change</button>
        </div>
      )}

      {!value && !pickingExisting && (
        <div className="button-row">
          <button className="btn-primary" onClick={handleGenerateNew} disabled={generating}>
            {generating ? "Generating…" : "Generate New"}
          </button>
          <button className="btn-secondary" onClick={() => setPickingExisting(true)}>Use Existing</button>
        </div>
      )}

      {!value && pickingExisting && (
        <div className="role-slot-picker">
          <EntitySearchPicker
            type={entityType}
            onSelect={(r) => {
              onChange({ kind: "existing", id: r.id, name: r.name });
              setPickingExisting(false);
            }}
          />
          <button className="btn-secondary" onClick={() => setPickingExisting(false)}>Cancel</button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}

export function AdventureForgePage() {
  const { worlds, worldId } = useActiveWorld();

  const [questGiver, setQuestGiver] = useState<RoleSlot<GeneratedCharacter> | null>(null);
  const [antagonist, setAntagonist] = useState<RoleSlot<GeneratedCharacter> | null>(null);
  const [startLocation, setStartLocation] = useState<RoleSlot<GeneratedLocation> | null>(null);
  const [climaxLocation, setClimaxLocation] = useState<RoleSlot<GeneratedLocation> | null>(null);
  const [reward, setReward] = useState<RoleSlot<GeneratedItem> | null>(null);
  const [encounterTable, setEncounterTable] = useState<RoleSlot<GeneratedEncounterTable> | null>(null);

  const [composed, setComposed] = useState<GeneratedAdventure | null>(null);
  const [weaving, setWeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saveOpen, setSaveOpen] = useState(false);
  const [saveWorldId, setSaveWorldId] = useState(worldId);
  const [saveTags, setSaveTags] = useState("");
  const [saveNotes, setSaveNotes] = useState("");
  const [saveHidden, setSaveHidden] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const allCoreFilled = !!(questGiver && antagonist && startLocation && climaxLocation && reward);

  async function handleWeave() {
    setWeaving(true);
    setError(null);
    try {
      const cast: AdventureCastNames = {
        questGiverName: slotName(questGiver),
        antagonistName: slotName(antagonist),
        startLocationName: slotName(startLocation),
        climaxLocationName: slotName(climaxLocation),
        rewardName: slotName(reward),
      };
      const generated = await api.generateAdventure({ cast });
      setComposed(generated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWeaving(false);
    }
  }

  function startOver() {
    setQuestGiver(null);
    setAntagonist(null);
    setStartLocation(null);
    setClimaxLocation(null);
    setReward(null);
    setEncounterTable(null);
    setComposed(null);
    setError(null);
    setSaveOpen(false);
    setSaveStatus("idle");
    setSaveTags("");
    setSaveNotes("");
  }

  async function handleSaveAdventure(patch?: GeneratedAdventure) {
    if (!composed) return;
    setSaveStatus("saving");
    setError(null);
    const worldId = saveWorldId || null;
    try {
      const [questGiverId, antagonistId, startLocationId, climaxLocationId, rewardId, encounterTableId] = await Promise.all([
        persistSlot(questGiver, (data, w) => api.saveCharacter({ ...data, worldId: w }), worldId),
        persistSlot(antagonist, (data, w) => api.saveCharacter({ ...data, worldId: w }), worldId),
        persistSlot(startLocation, (data, w) => api.saveLocation({ ...data, worldId: w }), worldId),
        persistSlot(climaxLocation, (data, w) => api.saveLocation({ ...data, worldId: w }), worldId),
        persistSlot(reward, (data, w) => api.saveItem({ ...data, worldId: w }), worldId),
        persistSlot(encounterTable, (data, w) => api.saveEncounterTable({ ...data, worldId: w }), worldId),
      ]);

      const adventure = await api.saveAdventure({
        ...(patch ?? composed),
        worldId,
        tags: saveTags.split(",").map((t) => t.trim()).filter(Boolean),
        notes: saveNotes || undefined,
        hiddenFromParty: saveHidden,
      });

      const cast: [string | null, EntityType, string][] = [
        [questGiverId, "character", "Quest Giver"],
        [antagonistId, "character", "Antagonist"],
        [startLocationId, "location", "Starting Location"],
        [climaxLocationId, "location", "Climax Location"],
        [rewardId, "item", "Reward"],
        [encounterTableId, "encounterTable", "Random Encounters"],
      ];
      await Promise.all(
        cast
          .filter(([id]) => id)
          .map(([id, type, label]) => api.createLink("adventure", adventure.id, type, id as string, label))
      );

      setSaveStatus("saved");
    } catch (e) {
      setError((e as Error).message);
      setSaveStatus("idle");
    }
  }

  const savePanelFields = (
    <SaveEntityFields
      worlds={worlds} worldId={saveWorldId} setWorldId={setSaveWorldId}
      tags={saveTags} setTags={setSaveTags} tagsPlaceholder="one-shot, act-1"
      notes={saveNotes} setNotes={setSaveNotes} notesPlaceholder="Anything else for your table…"
      hiddenFromParty={saveHidden} setHiddenFromParty={setSaveHidden}
    />
  );

  return (
    <div className="page">
      {!composed && (
        <div className="panel">
          <h2>Weave a One-Shot Adventure</h2>
          <p className="hint">
            Fill each role below (generate someone new or reuse an existing roster entry), then weave them
            into a ready-to-run adventure.
          </p>

          <RoleSlotPicker
            label="Quest Giver"
            entityType="character"
            generate={() => api.generate({ fullyRandom: true })}
            value={questGiver}
            onChange={setQuestGiver}
          />
          <RoleSlotPicker
            label="Antagonist"
            entityType="character"
            generate={() => api.generate({ fullyRandom: true })}
            value={antagonist}
            onChange={setAntagonist}
          />
          <RoleSlotPicker
            label="Starting Location"
            entityType="location"
            generate={() => api.generateLocation({ fullyRandom: true })}
            value={startLocation}
            onChange={setStartLocation}
          />
          <RoleSlotPicker
            label="Climax Location"
            entityType="location"
            generate={() => api.generateLocation({ fullyRandom: true })}
            value={climaxLocation}
            onChange={setClimaxLocation}
          />
          <RoleSlotPicker
            label="Reward"
            entityType="item"
            generate={() => api.generateItem({ fullyRandom: true })}
            value={reward}
            onChange={setReward}
          />
          <RoleSlotPicker
            label="Random Encounters"
            entityType="encounterTable"
            generate={() => api.generateEncounterTable({ fullyRandom: true })}
            value={encounterTable}
            onChange={setEncounterTable}
            optional
          />

          <button className="btn-primary" onClick={handleWeave} disabled={!allCoreFilled || weaving}>
            {weaving ? "Weaving…" : "Weave into Adventure"}
          </button>
          {!allCoreFilled && <p className="hint">Fill in Quest Giver, Antagonist, both locations, and a Reward to continue.</p>}
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {composed && (
        <div className="generator-layout">
          <div className="panel">
            <h2>The Cast</h2>
            <ul className="entity-list">
              <li><span className="entity-name">Quest Giver:</span> <span className="entity-meta">{slotName(questGiver)}</span></li>
              <li><span className="entity-name">Antagonist:</span> <span className="entity-meta">{slotName(antagonist)}</span></li>
              <li><span className="entity-name">Starting Location:</span> <span className="entity-meta">{slotName(startLocation)}</span></li>
              <li><span className="entity-name">Climax Location:</span> <span className="entity-meta">{slotName(climaxLocation)}</span></li>
              <li><span className="entity-name">Reward:</span> <span className="entity-meta">{slotName(reward)}</span></li>
              {encounterTable && <li><span className="entity-name">Random Encounters:</span> <span className="entity-meta">{slotName(encounterTable)}</span></li>}
            </ul>
            <button className="btn-secondary" onClick={startOver}>Start Over</button>
          </div>

          <div className="panel result-panel">
            <AdventureCardView adventure={composed} />

            {!saveOpen && saveStatus !== "saved" && (
              <button className="btn-secondary" onClick={() => setSaveOpen(true)}>Save to Roster</button>
            )}
            {saveStatus === "saved" && <p className="success">Saved to roster.</p>}

            {saveOpen && saveStatus !== "saved" && (
              <div className="save-panel">
                {savePanelFields}
                <button className="btn-primary" onClick={() => handleSaveAdventure()} disabled={saveStatus === "saving"}>
                  {saveStatus === "saving" ? "Saving…" : "Confirm Save"}
                </button>
              </div>
            )}
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
