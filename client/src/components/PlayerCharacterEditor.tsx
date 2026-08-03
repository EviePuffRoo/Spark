import { useState } from "react";
import type { PlayerCharacterInput, AbilityKey } from "@spark/shared";

const ABILITY_ORDER: { key: AbilityKey; label: string }[] = [
  { key: "str", label: "STR" },
  { key: "dex", label: "DEX" },
  { key: "con", label: "CON" },
  { key: "int", label: "INT" },
  { key: "wis", label: "WIS" },
  { key: "cha", label: "CHA" },
];

export function PlayerCharacterEditor({
  value, onSave, onCancel, saveLabel = "Save Content",
}: {
  value: PlayerCharacterInput;
  onSave: (patch: PlayerCharacterInput) => Promise<void>;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof PlayerCharacterInput>(key: K, val: PlayerCharacterInput[K]) {
    setDraft({ ...draft, [key]: val });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="content-editor">
      <label className="field">
        <span>Name</span>
        <input type="text" value={draft.name} onChange={(e) => set("name", e.target.value)} />
      </label>
      <label className="field">
        <span>Class</span>
        <input type="text" value={draft.className} onChange={(e) => set("className", e.target.value)} />
      </label>
      <label className="field">
        <span>Level</span>
        <input type="number" min={1} max={20} value={draft.level} onChange={(e) => set("level", Number(e.target.value))} />
      </label>
      <label className="field">
        <span>Race</span>
        <input type="text" value={draft.race} onChange={(e) => set("race", e.target.value)} />
      </label>
      <label className="field">
        <span>Armor Class</span>
        <input type="number" value={draft.armorClass} onChange={(e) => set("armorClass", Number(e.target.value))} />
      </label>
      <label className="field">
        <span>Max HP</span>
        <input type="number" value={draft.maxHp} onChange={(e) => set("maxHp", Number(e.target.value))} />
      </label>
      <label className="field">
        <span>Player Name (optional)</span>
        <input type="text" value={draft.playerName ?? ""} onChange={(e) => set("playerName", e.target.value || undefined)} />
      </label>

      <h3 className="section-heading">Ability Scores</h3>
      <div className="ability-grid editable">
        {ABILITY_ORDER.map(({ key, label }) => (
          <label className="field ability-field" key={key}>
            <span>{label}</span>
            <input
              type="number"
              value={draft.abilityScores[key]}
              onChange={(e) => set("abilityScores", { ...draft.abilityScores, [key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>

      <div className="button-row editor-actions">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : saveLabel}</button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
