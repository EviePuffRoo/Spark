import { useEffect, useState } from "react";
import type { GenerateEncounterTableRequest, GeneratedEncounterTable } from "@spark/shared";
import { api, type ReferenceData, type WorldSummary } from "../api";
import { EncounterTableCardView } from "../components/EncounterTableCardView";
import { EncounterTableEditor } from "../components/EncounterTableEditor";

const BLANK_ENCOUNTER_TABLE: GeneratedEncounterTable = { name: "", terrain: "", entries: [{ roll: "1", description: "" }] };

export function EncounterForgePage() {
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [creationMode, setCreationMode] = useState<"generate" | "manual">("generate");
  const [form, setForm] = useState<GenerateEncounterTableRequest>({});
  const [quantity, setQuantity] = useState<number | "">(1);
  const [results, setResults] = useState<GeneratedEncounterTable[]>([]);
  const [manualResult, setManualResult] = useState<GeneratedEncounterTable | null>(null);
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

  function switchMode(next: "generate" | "manual") {
    setCreationMode(next);
    setResults([]);
    setManualResult(null);
    setSaveOpen(false);
    setSaveStatus("idle");
  }

  async function handleGenerate() {
    const qty = Math.min(10, Math.max(1, Number(quantity) || 1));
    setLoading(true);
    setError(null);
    setSaveOpen(false);
    setSaveStatus("idle");
    try {
      const generated = await Promise.all(Array.from({ length: qty }, () => api.generateEncounterTable(form)));
      setResults(generated);
      setQuantity(qty);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function removeResult(index: number) {
    setResults(results.filter((_, i) => i !== index));
  }

  async function handleSaveAll() {
    if (results.length === 0) return;
    setSaveStatus("saving");
    try {
      await Promise.all(results.map((r) => api.saveEncounterTable({
        ...r,
        worldId: saveWorldId || null,
        tags: saveTags.split(",").map((t) => t.trim()).filter(Boolean),
        notes: saveNotes || undefined,
      })));
      setSaveStatus("saved");
    } catch (e) {
      setError((e as Error).message);
      setSaveStatus("idle");
    }
  }

  async function handleSaveManual() {
    if (!manualResult) return;
    setSaveStatus("saving");
    try {
      await api.saveEncounterTable({
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

  const fullyRandom = !!form.fullyRandom;

  const savePanelFields = (
    <>
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
    </>
  );

  const batchResultPanel = (
    <div className="panel result-panel">
      {results.length === 0 && <p className="hint">Generate a table to see it here.</p>}
      {results.length > 0 && (
        <>
          {results.map((table, index) => (
            <div className="batch-result-card" key={index}>
              <EncounterTableCardView table={table} />
              {results.length > 1 && saveStatus !== "saved" && (
                <button className="btn-danger" onClick={() => removeResult(index)} aria-label={`Remove ${table.name} from batch`}>Remove from batch</button>
              )}
            </div>
          ))}

          {!saveOpen && saveStatus !== "saved" && (
            <button className="btn-secondary" onClick={() => setSaveOpen(true)}>
              {results.length > 1 ? `Save All ${results.length} to Roster` : "Save to Roster"}
            </button>
          )}
          {saveStatus === "saved" && <p className="success">Saved {results.length > 1 ? `all ${results.length}` : "it"} to roster.</p>}

          {saveOpen && saveStatus !== "saved" && (
            <div className="save-panel">
              {savePanelFields}
              <button className="btn-primary" onClick={handleSaveAll} disabled={saveStatus === "saving"}>
                {saveStatus === "saving" ? "Saving…" : results.length > 1 ? `Confirm Save (${results.length})` : "Confirm Save"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="page">
      <div className="tabs forge-mode-tabs">
        <button className={creationMode === "generate" ? "active" : ""} aria-current={creationMode === "generate" ? "true" : undefined} onClick={() => switchMode("generate")}>Generate</button>
        <button className={creationMode === "manual" ? "active" : ""} aria-current={creationMode === "manual" ? "true" : undefined} onClick={() => switchMode("manual")}>Create Your Own</button>
      </div>

      {creationMode === "generate" && (
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

            <label className="field">
              <span>Quantity</span>
              <input
                type="number" min={1} max={10} value={quantity}
                onChange={(e) => {
                  const raw = e.target.value;
                  setQuantity(raw === "" ? "" : Number(raw));
                }}
                onBlur={() => setQuantity((q) => Math.min(10, Math.max(1, Number(q) || 1)))}
              />
            </label>

            <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
              {loading ? "Rolling…" : Number(quantity) > 1 ? `Generate ${quantity} Tables` : "Generate Table"}
            </button>
            {error && <p className="error">{error}</p>}
          </div>

          {batchResultPanel}
        </div>
      )}

      {creationMode === "manual" && !manualResult && (
        <div className="panel">
          <h2>Create Your Own Encounter Table</h2>
          <p className="hint">Write it exactly how you want it — nothing generated, all yours.</p>
          <EncounterTableEditor value={BLANK_ENCOUNTER_TABLE} onSave={async (draft) => setManualResult(draft)} onCancel={() => switchMode("generate")} saveLabel="Continue" />
        </div>
      )}

      {creationMode === "manual" && manualResult && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Create Your Own Encounter Table</h2>
            <p className="hint">Review it, then save it to your roster.</p>
            <button className="btn-secondary" onClick={() => setManualResult(null)}>← Edit Again</button>
          </div>
          <div className="panel result-panel">
            <EncounterTableCardView table={manualResult} />

            {!saveOpen && saveStatus !== "saved" && (
              <button className="btn-secondary" onClick={() => setSaveOpen(true)}>Save to Roster</button>
            )}
            {saveStatus === "saved" && <p className="success">Saved to roster.</p>}

            {saveOpen && saveStatus !== "saved" && (
              <div className="save-panel">
                {savePanelFields}
                <button className="btn-primary" onClick={handleSaveManual} disabled={saveStatus === "saving"}>
                  {saveStatus === "saving" ? "Saving…" : "Confirm Save"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
