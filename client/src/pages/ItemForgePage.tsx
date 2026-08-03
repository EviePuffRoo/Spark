import { useEffect, useState } from "react";
import type { GenerateItemRequest, GeneratedItem } from "@spark/shared";
import { api, type ReferenceData, type WorldSummary } from "../api";
import { ItemCardView } from "../components/ItemCardView";

export function ItemForgePage() {
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [form, setForm] = useState<GenerateItemRequest>({});
  const [result, setResult] = useState<GeneratedItem | null>(null);
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
      const generated = await api.generateItem(form);
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
      await api.saveItem({
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
          <h2>Forge an Item</h2>
          <p className="hint">Unique, flavorful gear — nothing game-breaking, just something worth remembering.</p>

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
                {reference?.itemCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Rarity</span>
              <select value={form.rarity ?? ""} onChange={(e) => setForm({ ...form, rarity: e.target.value || undefined })}>
                <option value="">Random</option>
                {reference?.itemRarities.map((r) => <option key={r} value={r}>{r}</option>)}
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
            {loading ? "Forging…" : "Forge Item"}
          </button>
          {error && <p className="error">{error}</p>}
        </div>

        <div className="panel result-panel">
          {!result && <p className="hint">Forge an item to see it here.</p>}
          {result && (
            <>
              <ItemCardView item={result} />

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
                    <input type="text" value={saveTags} onChange={(e) => setSaveTags(e.target.value)} placeholder="quest reward, cursed, market find" />
                  </label>
                  <label className="field">
                    <span>Notes</span>
                    <textarea value={saveNotes} onChange={(e) => setSaveNotes(e.target.value)} rows={3} placeholder="Where and how you plan to use it…" />
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
