import { useEffect, useState } from "react";
import type { GenerateLocationRequest, GeneratedLocation } from "@spark/shared";
import { api, type ReferenceData, type WorldSummary } from "../api";
import { LocationCardView } from "../components/LocationCardView";

export function LocationForgePage() {
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [form, setForm] = useState<GenerateLocationRequest>({});
  const [result, setResult] = useState<GeneratedLocation | null>(null);
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
      const generated = await api.generateLocation(form);
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
      await api.saveLocation({
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
          <h2>Sketch a Location</h2>
          <p className="hint">A place worth dropping into any session, with a feature, a keeper, and a rumor attached.</p>

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
              <span>Category</span>
              <select value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value || undefined })}>
                <option value="">Random</option>
                {reference?.locationCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
            {loading ? "Sketching…" : "Sketch Location"}
          </button>
          {error && <p className="error">{error}</p>}
        </div>

        <div className="panel result-panel">
          {!result && <p className="hint">Sketch a location to see it here.</p>}
          {result && (
            <>
              <LocationCardView location={result} />

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
                    <input type="text" value={saveTags} onChange={(e) => setSaveTags(e.target.value)} placeholder="act-1, home base, dangerous" />
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
      </div>
    </div>
  );
}
