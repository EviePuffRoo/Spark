import { useMemo, useState } from "react";
import type { DungeonInput, DungeonRoom, DungeonRoomRect, GenerateDungeonRequest, GeneratedDungeonOutline } from "@spark/shared";
import { layoutDungeonRooms } from "@spark/shared";
import { api } from "../api";
import { useActiveWorld } from "../ActiveWorldContext";
import { DungeonCardView } from "../components/DungeonCardView";
import { DungeonEditor } from "../components/DungeonEditor";
import { DungeonMapView } from "../components/DungeonMapView";
import { SaveToRosterControl, type SaveToRosterFields } from "../components/SaveToRosterControl";

const BLANK_DUNGEON: DungeonInput = { name: "", rooms: [] };
const noopUpdateRoomRect = () => {};

function outlineToPreview(outline: GeneratedDungeonOutline, rectByRoomId: Map<string, DungeonRoomRect>): DungeonInput {
  return {
    name: outline.name,
    rooms: outline.rooms.map((r) => ({ id: r.roomId, name: r.name, templateId: "", exits: r.exits, rect: rectByRoomId.get(r.roomId) })),
  };
}

export function DungeonCreatePage() {
  const { worlds, worldId } = useActiveWorld();
  const [creationMode, setCreationMode] = useState<"generate" | "manual">("generate");
  const [form, setForm] = useState<GenerateDungeonRequest>({});
  const [generated, setGenerated] = useState<GeneratedDungeonOutline | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [manualResult, setManualResult] = useState<DungeonInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [saveGeneration, setSaveGeneration] = useState(0);

  // Computed once per generation (it uses Math.random() internally) so the
  // pre-save preview and the actual save payload always show the same map.
  const rectByRoomId = useMemo(() => {
    if (!generated) return new Map<string, DungeonRoomRect>();
    const laidOut = layoutDungeonRooms(generated.rooms.map((r) => ({ id: r.roomId, exits: r.exits })));
    return new Map(laidOut.map((r) => [r.id, r.rect]));
  }, [generated]);

  function switchMode(next: "generate" | "manual") {
    setCreationMode(next);
    startOver();
  }

  function startOver() {
    setGenerated(null);
    setManualResult(null);
    setResetKey((k) => k + 1);
    setSaveGeneration((g) => g + 1);
    setError(null);
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setSaveGeneration((g) => g + 1);
    try {
      setGenerated(await api.generateDungeon(form));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Generated rooms don't have a real ZoneMapTemplate yet — create one
  // per room first (each with the room's single pre-rolled zone) so we
  // have real template ids, then assemble and save the Dungeon itself.
  async function saveGenerated(outline: GeneratedDungeonOutline, resolvedWorldId: string | null, tags: string[], notes: string | undefined, hidden: boolean) {
    const rooms: DungeonRoom[] = [];
    for (const room of outline.rooms) {
      const template = await api.saveZoneMapTemplate({
        name: room.name,
        zones: [{
          id: room.zoneId, name: room.name, tags: [], x: 300, y: 200,
          connections: [], revealed: true, hazard: room.hazard,
        }],
        worldId: resolvedWorldId,
      });
      rooms.push({ id: room.roomId, name: room.name, templateId: template.id, exits: room.exits, rect: rectByRoomId.get(room.roomId) });
    }
    await api.saveDungeon({ name: outline.name, rooms, worldId: resolvedWorldId, tags, notes, hiddenFromParty: hidden });
  }

  async function handleSave(fields: SaveToRosterFields) {
    if (creationMode === "generate" && generated) {
      await saveGenerated(generated, fields.worldId, fields.tags, fields.notes, fields.hiddenFromParty);
    } else if (manualResult) {
      await api.saveDungeon({ ...manualResult, ...fields });
    }
  }

  const fullyRandom = !!form.fullyRandom;

  const savePanel = (
    <>
      <SaveToRosterControl
        key={saveGeneration}
        worlds={worlds} defaultWorldId={worldId} onSave={handleSave}
        saveLabel="Save to Roster" savedLabel="Saved to roster."
        tagsPlaceholder="dungeon, act-1"
      />
      {error && <p className="error">{error}</p>}
    </>
  );

  return (
    <div className="page">
      <div className="tabs forge-mode-tabs">
        <button className={creationMode === "generate" ? "active" : ""} aria-current={creationMode === "generate" ? "true" : undefined} onClick={() => switchMode("generate")}>Generate</button>
        <button className={creationMode === "manual" ? "active" : ""} aria-current={creationMode === "manual" ? "true" : undefined} onClick={() => switchMode("manual")}>Build Your Own</button>
      </div>

      {creationMode === "generate" && !generated && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Generate a Dungeon</h2>
            <p className="hint">A connected set of rooms, each a ready-to-use zone map, some carrying a hazard.</p>

            <label className="field">
              <input
                type="checkbox"
                checked={fullyRandom}
                onChange={(e) => setForm({ fullyRandom: e.target.checked })}
              />
              {" "}Surprise me completely
            </label>

            <fieldset disabled={fullyRandom} className="fieldset">
              <label className="field">
                <span>Room count</span>
                <input
                  type="number" min={2} max={12}
                  value={form.roomCount ?? 5}
                  onChange={(e) => setForm({ ...form, roomCount: Number(e.target.value) })}
                />
              </label>
            </fieldset>

            <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
              {loading ? "Digging…" : "Generate Dungeon"}
            </button>
            {error && <p className="error">{error}</p>}
          </div>

          <div className="panel result-panel">
            <p className="hint">Generate a dungeon to see it here.</p>
          </div>
        </div>
      )}

      {creationMode === "generate" && generated && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Generate a Dungeon</h2>
            <p className="hint">Review it, then save it to your roster. Saving creates a Zone Map Template for each room.</p>
            <button className="btn-secondary" onClick={startOver}>← Generate Again</button>
          </div>
          <div className="panel result-panel">
            <DungeonCardView dungeon={{ ...outlineToPreview(generated, rectByRoomId), id: "", userId: "", worldId: null, hiddenFromParty: false, tags: [], createdAt: "", updatedAt: "" }} />
            <DungeonMapView
              dungeon={{ ...outlineToPreview(generated, rectByRoomId), id: "", userId: "", worldId: null, hiddenFromParty: false, tags: [], createdAt: "", updatedAt: "" }}
              canEdit={false}
              onUpdateRoomRect={noopUpdateRoomRect}
            />
            {savePanel}
          </div>
        </div>
      )}

      {creationMode === "manual" && !manualResult && (
        <div className="panel">
          <h2>Build a Dungeon</h2>
          <p className="hint">Chain together saved Zone Map Templates as rooms, then link exits between them.</p>
          <DungeonEditor
            key={resetKey}
            value={BLANK_DUNGEON}
            onSave={async (draft) => setManualResult(draft)}
            onCancel={() => setResetKey((k) => k + 1)}
            saveLabel="Continue"
          />
        </div>
      )}

      {creationMode === "manual" && manualResult && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Build a Dungeon</h2>
            <p className="hint">Review it, then save it to your roster.</p>
            <button className="btn-secondary" onClick={startOver}>← Edit Again</button>
          </div>
          <div className="panel result-panel">
            <DungeonCardView dungeon={{ ...manualResult, id: "", userId: "", worldId: null, hiddenFromParty: false, tags: [], createdAt: "", updatedAt: "" }} />
            <DungeonMapView
              dungeon={{ ...manualResult, id: "", userId: "", worldId: null, hiddenFromParty: false, tags: [], createdAt: "", updatedAt: "" }}
              canEdit={false}
              onUpdateRoomRect={noopUpdateRoomRect}
            />
            {savePanel}
          </div>
        </div>
      )}
    </div>
  );
}
