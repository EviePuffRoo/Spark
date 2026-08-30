import { useEffect, useState } from "react";
import type { GenerateRegionRequest, GeneratedRegion } from "@spark/shared";
import { api, type ReferenceData } from "../api";
import { useActiveWorld } from "../ActiveWorldContext";
import { RegionCardView } from "../components/RegionCardView";
import { RegionEditor } from "../components/RegionEditor";
import { SaveToRosterControl, type SaveToRosterFields } from "../components/SaveToRosterControl";

const BLANK_REGION: GeneratedRegion = { name: "", terrainCategory: "", description: "" };

export function RegionForgePage() {
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const { worlds, worldId } = useActiveWorld();
  const [creationMode, setCreationMode] = useState<"generate" | "manual">("generate");
  const [form, setForm] = useState<GenerateRegionRequest>({});
  const [generated, setGenerated] = useState<GeneratedRegion | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [manualResult, setManualResult] = useState<GeneratedRegion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [saveGeneration, setSaveGeneration] = useState(0);

  useEffect(() => {
    api.getReference().then(setReference).catch((e) => setError(e.message));
  }, []);

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
      setGenerated(await api.generateRegion(form));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const result = creationMode === "generate" ? generated : manualResult;

  async function handleSave(fields: SaveToRosterFields) {
    if (!result) return;
    await api.saveRegion({ ...result, ...fields });
  }

  const fullyRandom = !!form.fullyRandom;

  const savePanel = (
    <>
      <SaveToRosterControl
        key={saveGeneration}
        worlds={worlds} defaultWorldId={worldId} onSave={handleSave}
        saveLabel="Save to Roster" savedLabel="Saved to roster."
        tagsPlaceholder="frontier, act-1"
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
            <h2>Generate a Region</h2>
            <p className="hint">A stretch of territory with its own terrain, danger level, and character.</p>

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
                <select value={form.terrainCategory ?? ""} onChange={(e) => setForm({ ...form, terrainCategory: e.target.value || undefined })}>
                  <option value="">Random</option>
                  {reference?.terrainCategories.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            </fieldset>

            <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
              {loading ? "Mapping…" : "Generate Region"}
            </button>
            {error && <p className="error">{error}</p>}
          </div>

          <div className="panel result-panel">
            <p className="hint">Generate a region to see it here.</p>
          </div>
        </div>
      )}

      {creationMode === "generate" && generated && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Generate a Region</h2>
            <p className="hint">Review it, then save it to your roster. You can place it on the World Map afterward.</p>
            <button className="btn-secondary" onClick={startOver}>← Generate Again</button>
          </div>
          <div className="panel result-panel">
            <RegionCardView region={generated} />
            {savePanel}
          </div>
        </div>
      )}

      {creationMode === "manual" && !manualResult && (
        <div className="panel">
          <h2>Build a Region</h2>
          <p className="hint">Write it exactly how you want it. Nothing generated, all yours.</p>
          <RegionEditor
            key={resetKey}
            value={BLANK_REGION}
            onSave={async (draft) => setManualResult(draft)}
            onCancel={() => setResetKey((k) => k + 1)}
            saveLabel="Continue"
          />
        </div>
      )}

      {creationMode === "manual" && manualResult && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Build a Region</h2>
            <p className="hint">Review it, then save it to your roster.</p>
            <button className="btn-secondary" onClick={startOver}>← Edit Again</button>
          </div>
          <div className="panel result-panel">
            <RegionCardView region={manualResult} />
            {savePanel}
          </div>
        </div>
      )}
    </div>
  );
}
