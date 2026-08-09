import { useState } from "react";
import type { DungeonInput } from "@spark/shared";
import { api } from "../api";
import { useActiveWorld } from "../ActiveWorldContext";
import { DungeonCardView } from "../components/DungeonCardView";
import { DungeonEditor } from "../components/DungeonEditor";

const BLANK_DUNGEON: DungeonInput = { name: "", rooms: [] };

export function DungeonCreatePage() {
  const { worlds, worldId } = useActiveWorld();
  const [resetKey, setResetKey] = useState(0);
  const [manualResult, setManualResult] = useState<DungeonInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [saveOpen, setSaveOpen] = useState(false);
  const [saveWorldId, setSaveWorldId] = useState(worldId);
  const [saveTags, setSaveTags] = useState("");
  const [saveNotes, setSaveNotes] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  function startOver() {
    setManualResult(null);
    setResetKey((k) => k + 1);
    setSaveOpen(false);
    setSaveStatus("idle");
    setSaveTags("");
    setSaveNotes("");
  }

  async function handleSave() {
    if (!manualResult) return;
    setSaveStatus("saving");
    setError(null);
    try {
      await api.saveDungeon({
        ...manualResult,
        worldId: saveWorldId || null,
        tags: saveTags.split(",").map((t) => t.trim()).filter(Boolean),
        notes: saveNotes || undefined,
      });
      setSaveStatus("saved");
    } catch (e) {
      setError((e as Error).message);
      setSaveStatus("idle");
    }
  }

  return (
    <div className="page">
      {!manualResult && (
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

      {manualResult && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Build a Dungeon</h2>
            <p className="hint">Review it, then save it to your roster.</p>
            <button className="btn-secondary" onClick={startOver}>← Edit Again</button>
          </div>
          <div className="panel result-panel">
            <DungeonCardView dungeon={{
              ...manualResult,
              id: "", userId: "", worldId: null, hiddenFromParty: false, tags: [], createdAt: "", updatedAt: "",
            }} />

            {!saveOpen && saveStatus !== "saved" && (
              <button className="btn-secondary" onClick={() => setSaveOpen(true)}>Save to Roster</button>
            )}
            {saveStatus === "saved" && <p className="success">Saved to roster.</p>}

            {saveOpen && saveStatus !== "saved" && (
              <div className="save-panel">
                <label className="field">
                  <span>World (optional)</span>
                  <select value={saveWorldId} onChange={(e) => setSaveWorldId(e.target.value)}>
                    <option value="">Unassigned</option>
                    {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Tags (comma separated)</span>
                  <input type="text" value={saveTags} onChange={(e) => setSaveTags(e.target.value)} placeholder="dungeon, act-1" />
                </label>
                <label className="field">
                  <span>Notes</span>
                  <textarea value={saveNotes} onChange={(e) => setSaveNotes(e.target.value)} rows={3} />
                </label>
                <button className="btn-primary" onClick={handleSave} disabled={saveStatus === "saving"}>
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
