import { useEffect, useState } from "react";
import type { GenerateEncounterTableRequest, GeneratedEncounterTable } from "@spark/shared";
import { api, type ReferenceData, type WorldSummary } from "../api";
import { EncounterTableCardView } from "../components/EncounterTableCardView";

export function EncounterForgePage() {
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [form, setForm] = useState<GenerateEncounterTableRequest>({});
  const [result, setResult] = useState<GeneratedEncounterTable | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saveOpen, setSaveOpen] = useState(false);
  const [saveWorldId, setSaveWorldId] = useState("");
  const [saveTags, setSaveTags] = useState("");
  const [saveNotes, setSaveNotes] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    api.getReference().then(setReference).catch((e) => setError(e.message));
    api.listWorlds().then(setWorlds).catch(() => {});
  }, []);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setSaveOpen(false);
    setSaveStatus("idle");
    try {
      const generated = await api.generateEncounterTable(form);
      setResult(generated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    setSaveStatus("saving");
    try {
      await api.saveEncounterTable({
        ...result,
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

  const fullyRandom = !!form.fullyRandom;

  return (
    <div className="page">
      <div className="generator-layout">
        <div className="panel">
          <h2>Roll Up an Encounter Table</h2>
          <p className="hint">An 8-entry table for a terrain, ready to roll on during travel.</p>

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
              <span>Terrain</span>
              <select value={form.terrain ?? ""} onChange={(e) => setForm({ ...form, terrain: e.target.value || undefined })}>
                <option value="">Random</option>
                {reference?.encounterTerrains.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Name</span>
              <input
                type="text"
                placeholder="Random"
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value || undefined })}
              />
            </label>
          </fieldset>

          <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? "Rolling…" : "Generate Table"}
          </button>
          {error && <p className="error">{error}</p>}
        </div>

        <div className="panel result-panel">
          {!result && <p className="hint">Generate a table to see it here.</p>}
          {result && (
            <>
              <EncounterTableCardView table={result} />

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
                    <input type="text" value={saveTags} onChange={(e) => setSaveTags(e.target.value)} placeholder="travel, act-1" />
                  </label>
                  <label className="field">
                    <span>Notes</span>
                    <textarea value={saveNotes} onChange={(e) => setSaveNotes(e.target.value)} rows={3} placeholder="Where you plan to use this…" />
                  </label>
                  <button className="btn-primary" onClick={handleSave} disabled={saveStatus === "saving"}>
                    {saveStatus === "saving" ? "Saving…" : "Confirm Save"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
