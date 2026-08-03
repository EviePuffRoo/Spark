import { useEffect, useState } from "react";
import type { GenerateFactionRequest, GeneratedFaction } from "@spark/shared";
import { api, type ReferenceData, type WorldSummary } from "../api";
import { FactionCardView } from "../components/FactionCardView";
import { FactionEditor } from "../components/FactionEditor";

const BLANK_FACTION: GeneratedFaction = { name: "", factionType: "", agenda: "", methods: "", publicFace: "", hook: "" };

export function FactionForgePage() {
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [creationMode, setCreationMode] = useState<"generate" | "manual">("generate");
  const [form, setForm] = useState<GenerateFactionRequest>({});
  const [quantity, setQuantity] = useState<number | "">(1);
  const [results, setResults] = useState<GeneratedFaction[]>([]);
  const [manualResult, setManualResult] = useState<GeneratedFaction | null>(null);
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
      const generated = await Promise.all(Array.from({ length: qty }, () => api.generateFaction(form)));
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
      await Promise.all(results.map((r) => api.saveFaction({
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
      await api.saveFaction({
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
        <input type="text" value={saveTags} onChange={(e) => setSaveTags(e.target.value)} placeholder="antagonist, act-2, city" />
      </label>
      <label className="field">
        <span>Notes</span>
        <textarea value={saveNotes} onChange={(e) => setSaveNotes(e.target.value)} rows={3} placeholder="Where this fits in your world…" />
      </label>
    </>
  );

  const batchResultPanel = (
    <div className="panel result-panel">
      {results.length === 0 && <p className="hint">Found a faction to see it here.</p>}
      {results.length > 0 && (
        <>
          {results.map((faction, index) => (
            <div className="batch-result-card" key={index}>
              <FactionCardView faction={faction} />
              {results.length > 1 && saveStatus !== "saved" && (
                <button className="btn-danger" onClick={() => removeResult(index)} aria-label={`Remove ${faction.name} from batch`}>Remove from batch</button>
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
            <h2>Found a Faction</h2>
            <p className="hint">An organization with an agenda, methods, a public face, and a hook.</p>

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
                <span>Faction Type</span>
                <select value={form.factionType ?? ""} onChange={(e) => setForm({ ...form, factionType: e.target.value || undefined })}>
                  <option value="">Random</option>
                  {reference?.factionTypes.map((t) => <option key={t} value={t}>{t}</option>)}
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
              {loading ? "Founding…" : Number(quantity) > 1 ? `Found ${quantity}` : "Found Faction"}
            </button>
            {error && <p className="error">{error}</p>}
          </div>

          {batchResultPanel}
        </div>
      )}

      {creationMode === "manual" && !manualResult && (
        <div className="panel">
          <h2>Create Your Own Faction</h2>
          <p className="hint">Write it exactly how you want it — nothing generated, all yours.</p>
          <FactionEditor value={BLANK_FACTION} onSave={async (draft) => setManualResult(draft)} onCancel={() => switchMode("generate")} saveLabel="Continue" />
        </div>
      )}

      {creationMode === "manual" && manualResult && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Create Your Own Faction</h2>
            <p className="hint">Review it, then save it to your roster.</p>
            <button className="btn-secondary" onClick={() => setManualResult(null)}>← Edit Again</button>
          </div>
          <div className="panel result-panel">
            <FactionCardView faction={manualResult} />

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
