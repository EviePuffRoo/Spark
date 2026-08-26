import { useState } from "react";
import type { PlayerCharacterInput, AbilityKey, DeathSaves, SpellSlotLevel, ClassResource } from "@spark/shared";
import { EquipmentPanel } from "./EquipmentPanel";
import { HpTrackerPanel } from "./HpTrackerPanel";
import { DeathSavesPanel } from "./DeathSavesPanel";
import { SpellSlotsPanel } from "./SpellSlotsPanel";
import { PreparedSpellsPanel } from "./PreparedSpellsPanel";
import { ClassResourcePanel } from "./ClassResourcePanel";

const ABILITY_ORDER: { key: AbilityKey; label: string }[] = [
  { key: "str", label: "STR" },
  { key: "dex", label: "DEX" },
  { key: "con", label: "CON" },
  { key: "int", label: "INT" },
  { key: "wis", label: "WIS" },
  { key: "cha", label: "CHA" },
];

export interface PlayerCharacterLivingStatePatch {
  equippedItems?: string[];
  attunedItems?: string[];
  currentHp?: number;
  deathSaves?: DeathSaves;
  spellSlots?: SpellSlotLevel[];
  preparedSpells?: string[];
  classResources?: ClassResource[];
}

export function PlayerCharacterEditor({
  value, equippedItems, attunedItems, currentHp, deathSaves, spellSlots, preparedSpells, classResources,
  onSave, onCancel, saveLabel = "Save Content",
}: {
  value: PlayerCharacterInput;
  equippedItems?: string[];
  attunedItems?: string[];
  currentHp?: number;
  deathSaves?: DeathSaves;
  spellSlots?: SpellSlotLevel[];
  preparedSpells?: string[];
  classResources?: ClassResource[];
  onSave: (patch: PlayerCharacterInput & PlayerCharacterLivingStatePatch) => Promise<void>;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [equipped, setEquipped] = useState(equippedItems ?? []);
  const [attuned, setAttuned] = useState(attunedItems ?? []);
  const [hp, setHp] = useState(currentHp ?? 0);
  const [saves, setSaves] = useState(deathSaves ?? { successes: 0, failures: 0 });
  const [slots, setSlots] = useState(spellSlots ?? []);
  const [prepared, setPrepared] = useState(preparedSpells ?? []);
  const [resources, setResources] = useState(classResources ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof PlayerCharacterInput>(key: K, val: PlayerCharacterInput[K]) {
    setDraft({ ...draft, [key]: val });
  }

  async function handleSave() {
    // Mirrors the server's own required-field check (playerCharacters.ts)
    // so a blank Class/Race is caught here, on the form that still shows
    // the fields, instead of surfacing as a generic error after Continue
    // has already swapped this editor out for the review/save panel.
    const missing: string[] = [];
    if (!draft.name.trim()) missing.push("Name");
    if (!draft.className.trim()) missing.push("Class");
    if (!draft.race.trim()) missing.push("Race");
    if (!draft.level) missing.push("Level");
    if (!draft.armorClass) missing.push("Armor Class");
    if (!draft.maxHp) missing.push("Max HP");
    if (missing.length > 0) {
      setError(`Fill in: ${missing.join(", ")}.`);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const patch: PlayerCharacterInput & PlayerCharacterLivingStatePatch = { ...draft };
      if (equippedItems !== undefined) { patch.equippedItems = equipped; patch.attunedItems = attuned; }
      if (currentHp !== undefined) patch.currentHp = hp;
      if (deathSaves !== undefined) patch.deathSaves = saves;
      if (spellSlots !== undefined) patch.spellSlots = slots;
      if (preparedSpells !== undefined) patch.preparedSpells = prepared;
      if (classResources !== undefined) patch.classResources = resources;
      await onSave(patch);
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

      {equippedItems !== undefined && (
        <EquipmentPanel
          equippedItems={equipped}
          attunedItems={attuned}
          baseArmorClass={draft.armorClass}
          onChange={(eq, at) => { setEquipped(eq); setAttuned(at); }}
        />
      )}

      {currentHp !== undefined && (
        <HpTrackerPanel currentHp={hp} maxHp={draft.maxHp} onChange={setHp} />
      )}

      {deathSaves !== undefined && (
        <DeathSavesPanel deathSaves={saves} onChange={setSaves} />
      )}

      {spellSlots !== undefined && (
        <SpellSlotsPanel spellSlots={slots} onChange={setSlots} />
      )}

      {preparedSpells !== undefined && (
        <PreparedSpellsPanel preparedSpells={prepared} className={draft.className} onChange={setPrepared} />
      )}

      {classResources !== undefined && (
        <ClassResourcePanel resource={resources[0]} onChange={(r) => setResources([r])} />
      )}

      {error && <p className="error">{error}</p>}
      <div className="button-row editor-actions">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : saveLabel}</button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
