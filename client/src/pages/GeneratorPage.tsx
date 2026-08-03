import { useEffect, useState } from "react";
import type { GenerateRequest, GeneratedCharacter } from "@spark/shared";
import { api, type ReferenceData, type WorldSummary } from "../api";
import { StatBlockView } from "../components/StatBlockView";
import { BackstoryView } from "../components/BackstoryView";

const CR_OPTIONS = ["0", "1/8", "1/4", "1/2", "1", "2", "3", "5", "6", "8"];

export function GeneratorPage() {
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [form, setForm] = useState<GenerateRequest>({ kind: "npc" });
  const [result, setResult] = useState<GeneratedCharacter | null>(null);
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
      const generated = await api.generate(form);
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
      await api.saveCharacter({
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

          <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? "Conjuring…" : "Generate"}
          </button>
          {error && <p className="error">{error}</p>}
        </div>

        <div className="panel result-panel">
          {!result && <p className="hint">Generate an NPC or monster to see their stat block and backstory here.</p>}
          {result && (
            <>
              <StatBlockView
                name={result.name}
                subtitle={`${result.statBlock.size} ${result.statBlock.creatureType}, ${result.statBlock.alignment}${result.race ? ` — ${result.race}` : ""}${result.background ? `, ${result.background}` : ""}`}
                statBlock={result.statBlock}
              />
              <BackstoryView backstory={result.backstory} />

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
                    <input type="text" value={saveTags} onChange={(e) => setSaveTags(e.target.value)} placeholder="tavern, ally, act-1" />
                  </label>
                  <label className="field">
                    <span>Notes</span>
                    <textarea value={saveNotes} onChange={(e) => setSaveNotes(e.target.value)} rows={3} placeholder="Where and how you plan to use them…" />
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
