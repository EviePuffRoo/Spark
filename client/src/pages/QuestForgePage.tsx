import { useEffect, useState } from "react";
import type { GenerateQuestHookRequest, GeneratedQuestHook } from "@spark/shared";
import { api, type ReferenceData, type WorldSummary } from "../api";
import { QuestHookCardView } from "../components/QuestHookCardView";
import { QuestEditor } from "../components/QuestEditor";

const BLANK_QUEST: GeneratedQuestHook = { title: "", questType: "", tier: "", hook: "", objective: "", complication: "", reward: "" };

export function QuestForgePage() {
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [creationMode, setCreationMode] = useState<"generate" | "manual">("generate");
  const [form, setForm] = useState<GenerateQuestHookRequest>({});
  const [quantity, setQuantity] = useState(1);
  const [results, setResults] = useState<GeneratedQuestHook[]>([]);
  const [manualResult, setManualResult] = useState<GeneratedQuestHook | null>(null);
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
    setLoading(true);
    setError(null);
    setSaveOpen(false);
    setSaveStatus("idle");
    try {
      const generated = await Promise.all(Array.from({ length: quantity }, () => api.generateQuest(form)));
      setResults(generated);
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
      await Promise.all(results.map((r) => api.saveQuest({
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
      await api.saveQuest({
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
        <input type="text" value={saveTags} onChange={(e) => setSaveTags(e.target.value)} placeholder="side quest, act-2, patron" />
      </label>
      <label className="field">
        <span>Notes</span>
        <textarea value={saveNotes} onChange={(e) => setSaveNotes(e.target.value)} rows={3} placeholder="Who gives this, or how it connects…" />
      </label>
    </>
  );

  const batchResultPanel = (
    <div className="panel result-panel">
      {results.length === 0 && <p className="hint">Draft a quest hook to see it here.</p>}
      {results.length > 0 && (
        <>
          {results.map((quest, index) => (
            <div className="batch-result-card" key={index}>
              <QuestHookCardView quest={quest} />
              {results.length > 1 && saveStatus !== "saved" && (
                <button className="btn-danger" onClick={() => removeResult(index)}>Remove from batch</button>
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
        <button className={creationMode === "generate" ? "active" : ""} onClick={() => switchMode("generate")}>Generate</button>
        <button className={creationMode === "manual" ? "active" : ""} onClick={() => switchMode("manual")}>Create Your Own</button>
      </div>

      {creationMode === "generate" && (
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

            <label className="field">
              <span>Quantity</span>
              <input
                type="number" min={1} max={10} value={quantity}
                onChange={(e) => setQuantity(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
              />
            </label>

            <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
              {loading ? "Drafting…" : quantity > 1 ? `Draft ${quantity}` : "Draft Quest Hook"}
            </button>
            {error && <p className="error">{error}</p>}
          </div>

          {batchResultPanel}
        </div>
      )}

      {creationMode === "manual" && !manualResult && (
        <div className="panel">
          <h2>Create Your Own Quest Hook</h2>
          <p className="hint">Write it exactly how you want it — nothing generated, all yours.</p>
          <QuestEditor value={BLANK_QUEST} onSave={async (draft) => setManualResult(draft)} onCancel={() => switchMode("generate")} saveLabel="Continue" />
        </div>
      )}

      {creationMode === "manual" && manualResult && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Create Your Own Quest Hook</h2>
            <p className="hint">Review it, then save it to your roster.</p>
            <button className="btn-secondary" onClick={() => setManualResult(null)}>← Edit Again</button>
          </div>
          <div className="panel result-panel">
            <QuestHookCardView quest={manualResult} />

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
