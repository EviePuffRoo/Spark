import { useEffect, useState } from "react";
import type { GenerateRequest, GeneratedCharacter } from "@spark/shared";
import { api, type ReferenceData } from "../api";
import { useActiveWorld } from "../ActiveWorldContext";
import { StatBlockView } from "../components/StatBlockView";
import { BackstoryView } from "../components/BackstoryView";
import { SaveToRosterControl, type SaveToRosterFields } from "../components/SaveToRosterControl";

const CR_OPTIONS = ["0", "1/8", "1/4", "1/2", "1", "2", "3", "5", "6", "8"];

export function GeneratorPage() {
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const { worlds, worldId } = useActiveWorld();
  const [form, setForm] = useState<GenerateRequest>({ kind: "npc" });
  const [quantity, setQuantity] = useState<number | "">(1);
  const [results, setResults] = useState<GeneratedCharacter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saveGeneration, setSaveGeneration] = useState(0);

  useEffect(() => {
    api.getReference().then(setReference).catch((e) => setError(e.message));
  }, []);

  async function handleGenerate() {
    const qty = Math.min(10, Math.max(1, Number(quantity) || 1));
    setLoading(true);
    setError(null);
    setSaveGeneration((g) => g + 1);
    try {
      const generated = await Promise.all(Array.from({ length: qty }, () => api.generate(form)));
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
    await Promise.all(results.map((r) => api.saveCharacter({ ...r, ...fields })));
  }

  const fullyRandom = !!form.fullyRandom;
  const kind = form.kind ?? "npc";

  return (
    <div className="page">
      <div className="generator-layout">
        <div className="panel">
          <h2>Generate</h2>

          <label className="field">
            <input
              type="checkbox"
              checked={fullyRandom}
              onChange={(e) => setForm({ kind: form.kind, fullyRandom: e.target.checked })}
            />
            {" "}Surprise me completely (ignore all fields below, randomize everything)
          </label>

          <fieldset disabled={fullyRandom} className="fieldset">
            <label className="field">
              <span>Type</span>
              <select value={kind} onChange={(e) => setForm({ ...form, kind: e.target.value as GenerateRequest["kind"] })}>
                <option value="npc">NPC</option>
                <option value="monster">Monster</option>
                <option value="random">Surprise me (NPC or Monster)</option>
              </select>
            </label>

            {kind === "npc" && (
              <>
                <label className="field">
                  <span>Race</span>
                  <select value={form.race ?? ""} onChange={(e) => setForm({ ...form, race: e.target.value || undefined })}>
                    <option value="">Random</option>
                    {reference?.races.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Role / Template</span>
                  <select value={form.templateId ?? ""} onChange={(e) => setForm({ ...form, templateId: e.target.value || undefined })}>
                    <option value="">Random (respects Challenge Rating below)</option>
                    {reference?.npcTemplates.map((t) => <option key={t.id} value={t.id}>{t.name} (CR {t.challengeRating})</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Background</span>
                  <select value={form.background ?? ""} onChange={(e) => setForm({ ...form, background: e.target.value || undefined })}>
                    <option value="">Random</option>
                    {reference?.backgrounds.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </label>
              </>
            )}

            {kind === "monster" && (
              <label className="field">
                <span>Monster</span>
                <select value={form.templateId ?? ""} onChange={(e) => setForm({ ...form, templateId: e.target.value || undefined })}>
                  <option value="">Random (respects Challenge Rating below)</option>
                  {reference?.monsterTemplates.map((t) => <option key={t.id} value={t.id}>{t.name} (CR {t.challengeRating})</option>)}
                </select>
              </label>
            )}

            {kind !== "random" && (
              <label className="field">
                <span>Challenge Rating</span>
                <select value={form.challengeRating ?? ""} onChange={(e) => setForm({ ...form, challengeRating: e.target.value || undefined })}>
                  <option value="">Random</option>
                  {CR_OPTIONS.map((cr) => <option key={cr} value={cr}>{cr}</option>)}
                </select>
              </label>
            )}

            <label className="field">
              <span>Alignment</span>
              <select value={form.alignment ?? ""} onChange={(e) => setForm({ ...form, alignment: e.target.value || undefined })}>
                <option value="">Random / typical</option>
                {reference?.alignments.map((a) => <option key={a} value={a}>{a}</option>)}
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
            {loading ? "Conjuring…" : Number(quantity) > 1 ? `Generate ${quantity}` : "Generate"}
          </button>
          {error && <p className="error">{error}</p>}
        </div>

        <div className="panel result-panel">
          {results.length === 0 && <p className="hint">Generate an NPC or monster to see their stat block and backstory here.</p>}
          {results.length > 0 && (
            <>
              {results.map((result, index) => (
                <div className="batch-result-card" key={index}>
                  <StatBlockView
                    name={result.name}
                    subtitle={`${result.statBlock.size} ${result.statBlock.creatureType}, ${result.statBlock.alignment}${result.race ? ` · ${result.race}` : ""}${result.background ? `, ${result.background}` : ""}`}
                    statBlock={result.statBlock}
                  />
                  <BackstoryView backstory={result.backstory} />
                  {results.length > 1 && (
                    <button className="btn-danger" onClick={() => removeResult(index)} aria-label={`Remove ${result.name} from batch`}>Remove from batch</button>
                  )}
                </div>
              ))}

              <SaveToRosterControl
                key={saveGeneration}
                worlds={worlds} defaultWorldId={worldId} onSave={handleSaveAll}
                saveLabel={results.length > 1 ? `Save All ${results.length} to Roster` : "Save to Roster"}
                savedLabel={`Saved ${results.length > 1 ? `all ${results.length}` : "it"} to roster.`}
                tagsPlaceholder="tavern, ally, act-1"
                notesPlaceholder="Where and how you plan to use them…"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
