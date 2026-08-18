import { useEffect, useState } from "react";
import type { GenerateSettlementRequest, GeneratedSettlement, SearchResult } from "@spark/shared";
import { api, type ReferenceData } from "../api";
import { useActiveWorld } from "../ActiveWorldContext";
import { SettlementCardView } from "../components/SettlementCardView";
import { SettlementEditor } from "../components/SettlementEditor";
import { EntitySearchPicker } from "../components/EntitySearchPicker";
import { SaveEntityFields } from "../components/SaveEntityFields";

const BLANK_SETTLEMENT: GeneratedSettlement = { name: "", settlementType: "", description: "" };

export function SettlementForgePage() {
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const { worlds, worldId } = useActiveWorld();
  const [creationMode, setCreationMode] = useState<"generate" | "manual">("generate");
  const [form, setForm] = useState<GenerateSettlementRequest>({});
  const [generated, setGenerated] = useState<GeneratedSettlement | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [manualResult, setManualResult] = useState<GeneratedSettlement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [saveOpen, setSaveOpen] = useState(false);
  const [saveWorldId, setSaveWorldId] = useState(worldId);
  const [saveTags, setSaveTags] = useState("");
  const [saveNotes, setSaveNotes] = useState("");
  const [saveHidden, setSaveHidden] = useState(false);
  const [saveRegion, setSaveRegion] = useState<SearchResult | null>(null);
  const [pickingRegion, setPickingRegion] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

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
    setSaveOpen(false);
    setSaveStatus("idle");
    setSaveTags("");
    setSaveNotes("");
    setSaveRegion(null);
    setPickingRegion(false);
    setError(null);
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setSaveOpen(false);
    setSaveStatus("idle");
    try {
      setGenerated(await api.generateSettlement(form));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const result = creationMode === "generate" ? generated : manualResult;

  async function handleSave() {
    if (!result) return;
    setSaveStatus("saving");
    setError(null);
    try {
      await api.saveSettlement({
        ...result,
        worldId: saveWorldId || null,
        regionId: saveRegion?.id ?? null,
        tags: saveTags.split(",").map((t) => t.trim()).filter(Boolean),
        notes: saveNotes || undefined,
        hiddenFromParty: saveHidden,
      });
      setSaveStatus("saved");
    } catch (e) {
      setError((e as Error).message);
      setSaveStatus("idle");
    }
  }

  const fullyRandom = !!form.fullyRandom;

  const savePanel = (
    <>
      {!saveOpen && saveStatus !== "saved" && (
        <button className="btn-secondary" onClick={() => setSaveOpen(true)}>Save to Roster</button>
      )}
      {saveStatus === "saved" && <p className="success">Saved to roster.</p>}
      {saveOpen && saveStatus !== "saved" && (
        <div className="save-panel">
          <label className="field">
            <span>Region (optional)</span>
            {saveRegion ? (
              <div className="role-slot-filled">
                <span className="role-slot-value">{saveRegion.name}</span>
                <button className="btn-secondary" onClick={() => setSaveRegion(null)}>Clear</button>
              </div>
            ) : pickingRegion ? (
              <EntitySearchPicker type="region" onSelect={(r) => { setSaveRegion(r); setPickingRegion(false); }} placeholder="Search regions…" />
            ) : (
              <button className="btn-secondary" onClick={() => setPickingRegion(true)}>+ Anchor to a Region</button>
            )}
          </label>
          <SaveEntityFields
            worlds={worlds} worldId={saveWorldId} setWorldId={setSaveWorldId}
            tags={saveTags} setTags={setSaveTags} tagsPlaceholder="capital, act-1"
            notes={saveNotes} setNotes={setSaveNotes}
            hiddenFromParty={saveHidden} setHiddenFromParty={setSaveHidden}
          />
          <button className="btn-primary" onClick={handleSave} disabled={saveStatus === "saving"}>
            {saveStatus === "saving" ? "Saving…" : "Confirm Save"}
          </button>
        </div>
      )}
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
            <h2>Generate a Settlement</h2>
            <p className="hint">A town, city, or outpost with a population, a government, and a character of its own.</p>

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
                <span>Settlement type</span>
                <select value={form.settlementType ?? ""} onChange={(e) => setForm({ ...form, settlementType: e.target.value || undefined })}>
                  <option value="">Random</option>
                  {reference?.settlementTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            </fieldset>

            <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
              {loading ? "Founding…" : "Generate Settlement"}
            </button>
            {error && <p className="error">{error}</p>}
          </div>

          <div className="panel result-panel">
            <p className="hint">Generate a settlement to see it here.</p>
          </div>
        </div>
      )}

      {creationMode === "generate" && generated && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Generate a Settlement</h2>
            <p className="hint">Review it, then save it to your roster — optionally anchored to a Region.</p>
            <button className="btn-secondary" onClick={startOver}>← Generate Again</button>
          </div>
          <div className="panel result-panel">
            <SettlementCardView settlement={generated} />
            {savePanel}
          </div>
        </div>
      )}

      {creationMode === "manual" && !manualResult && (
        <div className="panel">
          <h2>Build a Settlement</h2>
          <p className="hint">Write it exactly how you want it — nothing generated, all yours.</p>
          <SettlementEditor
            key={resetKey}
            value={BLANK_SETTLEMENT}
            onSave={async (draft) => setManualResult(draft)}
            onCancel={() => setResetKey((k) => k + 1)}
            saveLabel="Continue"
          />
        </div>
      )}

      {creationMode === "manual" && manualResult && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Build a Settlement</h2>
            <p className="hint">Review it, then save it to your roster.</p>
            <button className="btn-secondary" onClick={startOver}>← Edit Again</button>
          </div>
          <div className="panel result-panel">
            <SettlementCardView settlement={manualResult} />
            {savePanel}
          </div>
        </div>
      )}
    </div>
  );
}
