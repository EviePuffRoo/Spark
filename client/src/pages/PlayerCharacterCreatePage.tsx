import { useEffect, useState } from "react";
import type { PlayerCharacterInput, GeneratePlayerCharacterRequest, GeneratedPlayerCharacter } from "@spark/shared";
import { parseCharacterText } from "@spark/shared";
import { api, type ReferenceData } from "../api";
import { useActiveWorld } from "../ActiveWorldContext";
import { PlayerCharacterCardView } from "../components/PlayerCharacterCardView";
import { PlayerCharacterEditor } from "../components/PlayerCharacterEditor";

const BLANK_PC: PlayerCharacterInput = {
  name: "", className: "", level: 1, race: "", armorClass: 10, maxHp: 10,
  abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
};

const IMPORT_FIELD_LABELS: Record<string, string> = {
  name: "Name", className: "Class", level: "Level", race: "Race",
  armorClass: "Armor Class", maxHp: "Max HP", abilityScores: "Ability scores", playerName: "Player name",
};

export function PlayerCharacterCreatePage() {
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const { worlds, worldId } = useActiveWorld();
  const [creationMode, setCreationMode] = useState<"generate" | "manual" | "import">("generate");
  const [form, setForm] = useState<GeneratePlayerCharacterRequest>({});
  const [generated, setGenerated] = useState<GeneratedPlayerCharacter | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [manualResult, setManualResult] = useState<PlayerCharacterInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [importText, setImportText] = useState("");
  const [importDraft, setImportDraft] = useState<PlayerCharacterInput | null>(null);
  const [importMatched, setImportMatched] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<PlayerCharacterInput | null>(null);

  const [saveOpen, setSaveOpen] = useState(false);
  const [saveWorldId, setSaveWorldId] = useState(worldId);
  const [saveTags, setSaveTags] = useState("");
  const [saveNotes, setSaveNotes] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    api.getReference().then(setReference).catch((e) => setError(e.message));
  }, []);

  function switchMode(next: "generate" | "manual" | "import") {
    setCreationMode(next);
    startOver();
  }

  function startOver() {
    setGenerated(null);
    setManualResult(null);
    setImportText("");
    setImportDraft(null);
    setImportMatched([]);
    setImportResult(null);
    setResetKey((k) => k + 1);
    setSaveOpen(false);
    setSaveStatus("idle");
    setSaveTags("");
    setSaveNotes("");
    setError(null);
  }

  function handleParseImport() {
    const { draft, matchedFields } = parseCharacterText(importText);
    setImportDraft(draft);
    setImportMatched(matchedFields);
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setSaveOpen(false);
    setSaveStatus("idle");
    try {
      setGenerated(await api.generatePlayerCharacter(form));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const result = creationMode === "generate" ? generated : creationMode === "manual" ? manualResult : importResult;

  async function handleSave() {
    if (!result) return;
    setSaveStatus("saving");
    setError(null);
    try {
      await api.savePlayerCharacter({
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

  const savePanel = (
    <>
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
            <input type="text" value={saveTags} onChange={(e) => setSaveTags(e.target.value)} placeholder="party, act-1" />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea value={saveNotes} onChange={(e) => setSaveNotes(e.target.value)} rows={3} />
          </label>
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
        <button className={creationMode === "manual" ? "active" : ""} aria-current={creationMode === "manual" ? "true" : undefined} onClick={() => switchMode("manual")}>Enter Your Own</button>
        <button className={creationMode === "import" ? "active" : ""} aria-current={creationMode === "import" ? "true" : undefined} onClick={() => switchMode("import")}>Paste to Import</button>
      </div>

      {creationMode === "generate" && !generated && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Generate a Player Character</h2>
            <p className="hint">A quick pre-gen — a hireling, a one-shot pick-up, or a starting point to hand a new player.</p>

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
                <span>Class</span>
                <select value={form.className ?? ""} onChange={(e) => setForm({ ...form, className: e.target.value || undefined })}>
                  <option value="">Random</option>
                  {reference?.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Race</span>
                <select value={form.race ?? ""} onChange={(e) => setForm({ ...form, race: e.target.value || undefined })}>
                  <option value="">Random</option>
                  {reference?.races.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Level</span>
                <input
                  type="number" min={1} max={20}
                  value={form.level ?? 1}
                  onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}
                />
              </label>
            </fieldset>

            <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
              {loading ? "Rolling…" : "Generate"}
            </button>
            {error && <p className="error">{error}</p>}
          </div>

          <div className="panel result-panel">
            <p className="hint">Generate a character to see it here.</p>
          </div>
        </div>
      )}

      {creationMode === "generate" && generated && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Generate a Player Character</h2>
            <p className="hint">Review it, then save it to your roster.</p>
            <button className="btn-secondary" onClick={startOver}>← Generate Again</button>
          </div>
          <div className="panel result-panel">
            <PlayerCharacterCardView pc={generated} />
            {savePanel}
          </div>
        </div>
      )}

      {creationMode === "manual" && !manualResult && (
        <div className="panel">
          <h2>Add a Player Character</h2>
          <p className="hint">Enter the character exactly as your player built them.</p>
          <PlayerCharacterEditor
            key={resetKey}
            value={BLANK_PC}
            onSave={async (draft) => setManualResult(draft)}
            onCancel={() => setResetKey((k) => k + 1)}
            saveLabel="Continue"
          />
        </div>
      )}

      {creationMode === "manual" && manualResult && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Add a Player Character</h2>
            <p className="hint">Review it, then save it to your roster.</p>
            <button className="btn-secondary" onClick={startOver}>← Edit Again</button>
          </div>
          <div className="panel result-panel">
            <PlayerCharacterCardView pc={manualResult} />
            {savePanel}
          </div>
        </div>
      )}

      {creationMode === "import" && !importDraft && (
        <div className="panel">
          <h2>Paste to Import</h2>
          <p className="hint">
            Paste a character sheet — a D&amp;D Beyond export, or your own notes with lines like
            "Class: Fighter" or "STR: 16". We'll pick out what we recognize; you review and fix the
            rest before saving.
          </p>
          <label className="field">
            <span>Character sheet text</span>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={12}
              placeholder={"Name: Elowen Brightblade\nClass: Ranger\nLevel: 5\nRace: Wood Elf\nArmor Class: 15\nHit Points: 42\nSTR: 14\nDEX: 18\n…"}
            />
          </label>
          <button className="btn-primary" onClick={handleParseImport} disabled={!importText.trim()}>
            Parse
          </button>
        </div>
      )}

      {creationMode === "import" && importDraft && !importResult && (
        <div className="panel">
          <h2>Review the Import</h2>
          {importMatched.length > 0 ? (
            <p className="hint">
              Picked up: {importMatched.map((f) => IMPORT_FIELD_LABELS[f] ?? f).join(", ")}. Check
              everything below and fill in anything we missed.
            </p>
          ) : (
            <p className="hint">Couldn't recognize any fields in that text — fill in the character below.</p>
          )}
          <button className="btn-secondary" onClick={() => { setImportDraft(null); setImportMatched([]); }}>
            ← Paste Different Text
          </button>
          <PlayerCharacterEditor
            key={resetKey}
            value={importDraft}
            onSave={async (draft) => setImportResult(draft)}
            onCancel={() => setResetKey((k) => k + 1)}
            saveLabel="Continue"
          />
        </div>
      )}

      {creationMode === "import" && importResult && (
        <div className="generator-layout">
          <div className="panel">
            <h2>Paste to Import</h2>
            <p className="hint">Review it, then save it to your roster.</p>
            <button className="btn-secondary" onClick={startOver}>← Start Over</button>
          </div>
          <div className="panel result-panel">
            <PlayerCharacterCardView pc={importResult} />
            {savePanel}
          </div>
        </div>
      )}
    </div>
  );
}
