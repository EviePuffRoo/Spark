import { useEffect, useState } from "react";
import type { GenerateQuestHookRequest, GeneratedQuestHook } from "@spark/shared";
import { api, type ReferenceData } from "../api";
import { useActiveWorld } from "../ActiveWorldContext";
import { QuestHookCardView } from "../components/QuestHookCardView";
import { QuestEditor } from "../components/QuestEditor";
import { SaveToRosterControl, type SaveToRosterFields } from "../components/SaveToRosterControl";

const BLANK_QUEST: GeneratedQuestHook = { title: "", questType: "", tier: "", hook: "", objective: "", complication: "", reward: "" };

export function QuestForgePage() {
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const { worlds, worldId } = useActiveWorld();
  const [creationMode, setCreationMode] = useState<"generate" | "manual">("generate");
  const [form, setForm] = useState<GenerateQuestHookRequest>({});
  const [quantity, setQuantity] = useState<number | "">(1);
  const [results, setResults] = useState<GeneratedQuestHook[]>([]);
  const [manualResult, setManualResult] = useState<GeneratedQuestHook | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saveGeneration, setSaveGeneration] = useState(0);

  useEffect(() => {
    api.getReference().then(setReference).catch((e) => setError(e.message));
  }, []);

  function switchMode(next: "generate" | "manual") {
    setCreationMode(next);
    setResults([]);
    setManualResult(null);
    setSaveGeneration((g) => g + 1);
  }

  async function handleGenerate() {
    const qty = Math.min(10, Math.max(1, Number(quantity) || 1));
    setLoading(true);
    setError(null);
    setSaveGeneration((g) => g + 1);
    try {
      const generated = await Promise.all(Array.from({ length: qty }, () => api.generateQuest(form)));
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

  async function handleSaveAll(fields: SaveToRosterFields) {
    if (results.length === 0) return;
    await Promise.all(results.map((r) => api.saveQuest({ ...r, ...fields })));
  }

  async function handleSaveManual(fields: SaveToRosterFields) {
    if (!manualResult) return;
    await api.saveQuest({ ...manualResult, ...fields });
  }

  const fullyRandom = !!form.fullyRandom;

  const batchResultPanel = (
    <div className="panel result-panel">
      {results.length === 0 && <p className="hint">Draft a quest hook to see it here.</p>}
      {results.length > 0 && (
        <>
          {results.map((quest, index) => (
            <div className="batch-result-card" key={index}>
              <QuestHookCardView quest={quest} />
              {results.length > 1 && (
                <button className="btn-danger" onClick={() => removeResult(index)} aria-label={`Remove ${quest.title} from batch`}>Remove from batch</button>
              )}
            </div>
          ))}

          <SaveToRosterControl
            key={saveGeneration}
            worlds={worlds} defaultWorldId={worldId} onSave={handleSaveAll}
            saveLabel={results.length > 1 ? `Save All ${results.length} to Roster` : "Save to Roster"}
            savedLabel={`Saved ${results.length > 1 ? `all ${results.length}` : "it"} to roster.`}
            tagsPlaceholder="side quest, act-2, patron"
            notesPlaceholder="Who gives this, or how it connects…"
          />
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
                onChange={(e) => {
                  const raw = e.target.value;
                  setQuantity(raw === "" ? "" : Number(raw));
                }}
                onBlur={() => setQuantity((q) => Math.min(10, Math.max(1, Number(q) || 1)))}
              />
            </label>

            <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
              {loading ? "Drafting…" : Number(quantity) > 1 ? `Draft ${quantity}` : "Draft Quest Hook"}
            </button>
            {error && <p className="error">{error}</p>}
          </div>

          {batchResultPanel}
        </div>
      )}

      {creationMode === "manual" && !manualResult && (
        <div className="panel">
          <h2>Create Your Own Quest Hook</h2>
          <p className="hint">Write it exactly how you want it. Nothing generated, all yours.</p>
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

            <SaveToRosterControl
              worlds={worlds} defaultWorldId={worldId} onSave={handleSaveManual}
              saveLabel="Save to Roster" savedLabel="Saved to roster."
              tagsPlaceholder="side quest, act-2, patron"
              notesPlaceholder="Who gives this, or how it connects…"
            />
          </div>
        </div>
      )}
    </div>
  );
}
