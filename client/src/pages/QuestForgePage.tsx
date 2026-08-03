import { useEffect, useState } from "react";
import type { GenerateQuestHookRequest, GeneratedQuestHook } from "@spark/shared";
import { api, type ReferenceData, type WorldSummary } from "../api";
import { QuestHookCardView } from "../components/QuestHookCardView";

export function QuestForgePage() {
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [form, setForm] = useState<GenerateQuestHookRequest>({});
  const [result, setResult] = useState<GeneratedQuestHook | null>(null);
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
      const generated = await api.generateQuest(form);
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
      await api.saveQuest({
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
          <h2>Draft a Quest Hook</h2>
          <p className="hint">A ready-to-use adventure seed: a hook, an objective, a complication, and a reward.</p>

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
              <span>Quest Type</span>
              <select value={form.questType ?? ""} onChange={(e) => setForm({ ...form, questType: e.target.value || undefined })}>
                <option value="">Random</option>
                {reference?.questTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Tier</span>
              <select value={form.tier ?? ""} onChange={(e) => setForm({ ...form, tier: e.target.value || undefined })}>
                <option value="">Random</option>
                {reference?.questTiers.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Title</span>
              <input
                type="text"
                placeholder="Random"
                value={form.title ?? ""}
                onChange={(e) => setForm({ ...form, title: e.target.value || undefined })}
              />
            </label>
          </fieldset>

          <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? "Drafting…" : "Draft Quest Hook"}
          </button>
          {error && <p className="error">{error}</p>}
        </div>

        <div className="panel result-panel">
          {!result && <p className="hint">Draft a quest hook to see it here.</p>}
          {result && (
            <>
              <QuestHookCardView quest={result} />

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
                    <input type="text" value={saveTags} onChange={(e) => setSaveTags(e.target.value)} placeholder="side quest, act-2, patron" />
                  </label>
                  <label className="field">
                    <span>Notes</span>
                    <textarea value={saveNotes} onChange={(e) => setSaveNotes(e.target.value)} rows={3} placeholder="Who gives this, or how it connects…" />
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
