import { useState } from "react";
import type { PlayerCharacterInput, AbilityKey } from "@spark/shared";
import { PC_STANDARD_ARRAY, CLASS_SKILL_CHOICES, POINT_BUY_BUDGET, pointBuyCost, pointBuyTotalCost, getRuleset } from "@spark/shared";
import { PlayerCharacterCardView } from "./PlayerCharacterCardView";
import type { ReferenceData } from "../api";

const abilityModifier = getRuleset().abilityModifier;
const proficiencyBonusForLevel = getRuleset().proficiencyBonusForLevel;

const ABILITY_ORDER: { key: AbilityKey; label: string }[] = [
  { key: "str", label: "STR" },
  { key: "dex", label: "DEX" },
  { key: "con", label: "CON" },
  { key: "int", label: "INT" },
  { key: "wis", label: "WIS" },
  { key: "cha", label: "CHA" },
];

const WIZARD_STEPS = ["Basics", "Ability Scores", "Skills", "Review"] as const;
type WizardStep = (typeof WIZARD_STEPS)[number];

type AbilityMode = "standard" | "pointBuy" | "manual";

const BLANK_SCORES: Record<AbilityKey, number> = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };

// A guided, step-by-step alternative to PlayerCharacterEditor's flat form
// for building a brand-new character — Race/Class → Ability Scores
// (Standard Array/Point Buy/Manual) → Skill Proficiencies → Review. Only
// used by PlayerCharacterCreatePage's "manual" mode; PlayerCharacterEditor
// itself stays untouched since it's also used to edit an already-existing
// PC's living state (equipment/HP/spells/etc.), which this wizard has no
// equivalent for.
export function PlayerCharacterWizard({
  reference, onSave, onCancel, pointBuyBudget = POINT_BUY_BUDGET,
}: {
  reference: ReferenceData | null;
  onSave: (draft: PlayerCharacterInput) => Promise<void>;
  onCancel: () => void;
  // Defaults to the base ruleset's budget (27) — a world with a
  // pointBuyBudget house rule passes its overridden value instead.
  pointBuyBudget?: number;
}) {
  const [step, setStep] = useState<WizardStep>("Basics");
  const [name, setName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [classId, setClassId] = useState("");
  const [raceId, setRaceId] = useState("");
  const [level, setLevel] = useState(1);
  const [armorClass, setArmorClass] = useState(10);
  const [maxHp, setMaxHp] = useState(10);

  const [abilityMode, setAbilityMode] = useState<AbilityMode>("standard");
  const [standardAssignments, setStandardAssignments] = useState<Record<AbilityKey, number | "">>({ str: "", dex: "", con: "", int: "", wis: "", cha: "" });
  const [pointBuyScores, setPointBuyScores] = useState<Record<AbilityKey, number>>({ ...BLANK_SCORES });
  const [manualScores, setManualScores] = useState<Record<AbilityKey, number>>({ str: 10, dex: 10, con: 10, wis: 10, int: 10, cha: 10 });

  const [skillProficiencies, setSkillProficiencies] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClass = reference?.classes.find((c) => c.id === classId);
  const selectedRace = reference?.races.find((r) => r.id === raceId);
  const skillChoice = classId ? CLASS_SKILL_CHOICES[classId] : undefined;

  const abilityScores: Record<AbilityKey, number> =
    abilityMode === "standard"
      ? { str: standardAssignments.str || 8, dex: standardAssignments.dex || 8, con: standardAssignments.con || 8, int: standardAssignments.int || 8, wis: standardAssignments.wis || 8, cha: standardAssignments.cha || 8 }
      : abilityMode === "pointBuy" ? pointBuyScores : manualScores;

  const usedStandardValues = new Set(Object.values(standardAssignments).filter((v) => v !== ""));
  const pointBuySpent = pointBuyTotalCost(pointBuyScores);

  function assignStandard(key: AbilityKey, value: string) {
    setStandardAssignments((prev) => ({ ...prev, [key]: value === "" ? "" : Number(value) }));
  }

  function adjustPointBuy(key: AbilityKey, delta: 1 | -1) {
    setPointBuyScores((prev) => {
      const next = prev[key] + delta;
      if (next < 8 || next > 15) return prev;
      const cost = pointBuyCost(next) - pointBuyCost(prev[key]);
      if (pointBuySpent + cost > pointBuyBudget) return prev;
      return { ...prev, [key]: next };
    });
  }

  function toggleSkill(name: string) {
    setSkillProficiencies((prev) => {
      if (prev.includes(name)) return prev.filter((s) => s !== name);
      if (skillChoice && prev.length >= skillChoice.choose) return prev;
      return [...prev, name];
    });
  }

  function goToStep(next: WizardStep) {
    setError(null);
    setStep(next);
  }

  function validateBasics(): string | null {
    if (!name.trim()) return "Name is required.";
    if (!selectedClass) return "Choose a class.";
    if (!selectedRace) return "Choose a race.";
    if (!armorClass) return "Armor Class is required.";
    if (!maxHp) return "Max HP is required.";
    return null;
  }

  function nextFromBasics() {
    const err = validateBasics();
    if (err) { setError(err); return; }
    goToStep("Ability Scores");
  }

  function nextFromAbilities() {
    if (abilityMode === "standard" && usedStandardValues.size < 6) {
      setError("Assign all six standard array values before continuing.");
      return;
    }
    goToStep("Skills");
  }

  function draft(): PlayerCharacterInput {
    return {
      name: name.trim(),
      className: selectedClass?.name ?? "",
      level,
      race: selectedRace?.name ?? "",
      armorClass,
      maxHp,
      abilityScores,
      playerName: playerName.trim() || undefined,
      skillProficiencies,
      proficiencyBonus: proficiencyBonusForLevel(level),
    };
  }

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="content-editor pc-wizard">
      <div className="tabs pc-wizard-steps" role="tablist">
        {WIZARD_STEPS.map((s, i) => (
          <button
            key={s}
            role="tab"
            className={step === s ? "active" : ""}
            aria-selected={step === s}
            disabled={i > WIZARD_STEPS.indexOf(step) && (i > 1 || validateBasics() !== null)}
            onClick={() => goToStep(s)}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {step === "Basics" && (
        <>
          <label className="field">
            <span>Name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Class</span>
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Choose a class…</option>
              {reference?.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Race</span>
            <select value={raceId} onChange={(e) => setRaceId(e.target.value)}>
              <option value="">Choose a race…</option>
              {reference?.races.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Level</span>
            <input type="number" min={1} max={20} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>Armor Class</span>
            <input type="number" value={armorClass} onChange={(e) => setArmorClass(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>Max HP</span>
            <input type="number" value={maxHp} onChange={(e) => setMaxHp(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>Player Name (optional)</span>
            <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="button-row editor-actions">
            <button className="btn-primary" onClick={nextFromBasics}>Next: Ability Scores</button>
            <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          </div>
        </>
      )}

      {step === "Ability Scores" && (
        <>
          <div className="tabs apply-mode-toggle" role="tablist">
            <button role="tab" className={abilityMode === "standard" ? "active" : ""} aria-selected={abilityMode === "standard"} onClick={() => setAbilityMode("standard")}>Standard Array</button>
            <button role="tab" className={abilityMode === "pointBuy" ? "active" : ""} aria-selected={abilityMode === "pointBuy"} onClick={() => setAbilityMode("pointBuy")}>Point Buy</button>
            <button role="tab" className={abilityMode === "manual" ? "active" : ""} aria-selected={abilityMode === "manual"} onClick={() => setAbilityMode("manual")}>Manual</button>
          </div>

          {abilityMode === "standard" && (
            <>
              <p className="hint">Assign each of {PC_STANDARD_ARRAY.join(", ")} to one ability score.</p>
              <div className="ability-grid editable">
                {ABILITY_ORDER.map(({ key, label }) => (
                  <label className="field ability-field" key={key}>
                    <span>{label}</span>
                    <select value={standardAssignments[key]} onChange={(e) => assignStandard(key, e.target.value)}>
                      <option value="">—</option>
                      {PC_STANDARD_ARRAY.map((v) => (
                        <option key={v} value={v} disabled={usedStandardValues.has(v) && standardAssignments[key] !== v}>{v}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </>
          )}

          {abilityMode === "pointBuy" && (
            <>
              <p className="hint">Budget: {pointBuySpent} / {pointBuyBudget} points spent.</p>
              <div className="ability-grid editable">
                {ABILITY_ORDER.map(({ key, label }) => (
                  <div className="field ability-field" key={key}>
                    <span>{label}</span>
                    <div className="button-row">
                      <button className="btn-secondary" onClick={() => adjustPointBuy(key, -1)} disabled={pointBuyScores[key] <= 8} aria-label={`Decrease ${label}`}>−</button>
                      <span className="mono">{pointBuyScores[key]}</span>
                      <button className="btn-secondary" onClick={() => adjustPointBuy(key, 1)} disabled={pointBuyScores[key] >= 15} aria-label={`Increase ${label}`}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {abilityMode === "manual" && (
            <div className="ability-grid editable">
              {ABILITY_ORDER.map(({ key, label }) => (
                <label className="field ability-field" key={key}>
                  <span>{label}</span>
                  <input type="number" value={manualScores[key]} onChange={(e) => setManualScores((prev) => ({ ...prev, [key]: Number(e.target.value) }))} />
                </label>
              ))}
            </div>
          )}

          {error && <p className="error">{error}</p>}
          <div className="button-row editor-actions">
            <button className="btn-secondary" onClick={() => goToStep("Basics")}>Back</button>
            <button className="btn-primary" onClick={nextFromAbilities}>Next: Skills</button>
          </div>
        </>
      )}

      {step === "Skills" && (
        <>
          {skillChoice ? (
            <>
              <p className="hint">{selectedClass?.name} may choose {skillChoice.choose} skill{skillChoice.choose === 1 ? "" : "s"} ({skillProficiencies.length}/{skillChoice.choose} selected).</p>
              <div className="button-row skill-picker">
                {skillChoice.choices.map((s) => (
                  <button
                    key={s}
                    className={skillProficiencies.includes(s) ? "active" : ""}
                    onClick={() => toggleSkill(s)}
                    disabled={!skillProficiencies.includes(s) && skillProficiencies.length >= skillChoice.choose}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="hint">No skill list on file for this class — skip this step, or add proficiencies later from the character sheet.</p>
          )}
          <div className="button-row editor-actions">
            <button className="btn-secondary" onClick={() => goToStep("Ability Scores")}>Back</button>
            <button className="btn-primary" onClick={() => goToStep("Review")}>Next: Review</button>
          </div>
        </>
      )}

      {step === "Review" && (
        <>
          <PlayerCharacterCardView pc={draft()} />
          <p className="hint">
            {ABILITY_ORDER.map(({ key, label }) => `${label} ${abilityModifier(abilityScores[key]) >= 0 ? "+" : ""}${abilityModifier(abilityScores[key])}`).join(" · ")}
          </p>
          {error && <p className="error">{error}</p>}
          <div className="button-row editor-actions">
            <button className="btn-secondary" onClick={() => goToStep("Skills")}>Back</button>
            <button className="btn-primary" onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Create Character"}</button>
            <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
