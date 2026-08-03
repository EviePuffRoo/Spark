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
  const [result, setResult] = useState<GeneratedFaction | null>(null);
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
    setResult(null);
    setSaveOpen(false);
    setSaveStatus("idle");
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setSaveOpen(false);
    setSaveStatus("idle");
    try {
      const generated = await api.generateFaction(form);
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
      await api.saveFaction({
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

  const resultPanel = (
    <div className="panel result-panel">
      {!result && <p className="hint">Found a faction to see it here.</p>}
      {result && (
        <>
          <FactionCardView faction={result} />

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
                <input type="text" value={saveTags} onChange={(e) => setSaveTags(e.target.value)} placeholder="antagonist, act-2, city" />
              </label>
              <label className="field">
                <span>Notes</span>
                <textarea value={saveNotes} onChange={(e) => setSaveNotes(e.target.value)} rows={3} placeholder="Where this fits in your world…" />
              </label>
              <button className="btn-primary" onClick={handleSave} disabled={saveStatus === "saving"}>
                {saveStatus === "saving" ? "Saving…" : "Confirm Save"}
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
        <button className={creationMode === "generate" ? "active" : ""} onClick={() => switchMode("generate")}>Generate</button>
        <button className={creationMode === "manual" ? "active" : ""} onClick={() => switchMode("manual")}>Create Your Own</button>
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

            <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
              {loading ? "Founding…" : "Found Faction"}
            </button>
            {error && <p className="error">{error}</p>}
          </div>

          {resultPanel}
        </div>
      )}

      {creationMode === "manual" && !result && (
        <div className="panel">
          <h2>Create Your Own Faction</h2>
          <p className="hint">Write it exactly how you want it — nothing generated, all yours.</p>
          <FactionEditor value={BLANK_FACTION} onSave={async (draft) => setResult(draft)} onCancel={() => switchMode("generate")} saveLabel="Continue" />
        </div>
      )}

      {creationMode === "manual" && result && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Create Your Own Faction</h2>
            <p className="hint">Review it, then save it to your roster.</p>
            <button className="btn-secondary" onClick={() => setResult(null)}>← Edit Again</button>
          </div>
          {resultPanel}
        </div>
      )}
    </div>
  );
}
