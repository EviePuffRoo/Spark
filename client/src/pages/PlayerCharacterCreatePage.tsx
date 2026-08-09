import { useState } from "react";
import type { PlayerCharacterInput } from "@spark/shared";
import { api } from "../api";
import { useActiveWorld } from "../ActiveWorldContext";
import { PlayerCharacterCardView } from "../components/PlayerCharacterCardView";
import { PlayerCharacterEditor } from "../components/PlayerCharacterEditor";

const BLANK_PC: PlayerCharacterInput = {
  name: "", className: "", level: 1, race: "", armorClass: 10, maxHp: 10,
  abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
};

export function PlayerCharacterCreatePage() {
  const { worlds, worldId } = useActiveWorld();
  const [resetKey, setResetKey] = useState(0);
  const [manualResult, setManualResult] = useState<PlayerCharacterInput | null>(null);
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
      await api.savePlayerCharacter({
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
          <h2>Add a Player Character</h2>
          <p className="hint">Enter the character exactly as your player built them.</p>
          <PlayerCharacterEditor
            key={resetKey}
            value={BLANK_PC}
            onSave={async (draft) => setManualResult(draft)}
            onCancel={() => setResetKey((k) => k + 1)}
            saveLabel="Continue"
          />
        </div>
      )}

      {manualResult && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Add a Player Character</h2>
            <p className="hint">Review it, then save it to your roster.</p>
            <button className="btn-secondary" onClick={startOver}>← Edit Again</button>
          </div>
          <div className="panel result-panel">
            <PlayerCharacterCardView pc={manualResult} />

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
                  <input type="text" value={saveTags} onChange={(e) => setSaveTags(e.target.value)} placeholder="party, act-1" />
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
