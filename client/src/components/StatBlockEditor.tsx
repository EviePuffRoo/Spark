import type { AbilityKey, StatBlock } from "@spark/shared";
import { DynamicListEditor } from "./DynamicListEditor";

const ABILITY_ORDER: { key: AbilityKey; label: string }[] = [
  { key: "str", label: "STR" },
  { key: "dex", label: "DEX" },
  { key: "con", label: "CON" },
  { key: "int", label: "INT" },
  { key: "wis", label: "WIS" },
  { key: "cha", label: "CHA" },
];

export function StatBlockEditor({ value, onChange }: { value: StatBlock; onChange: (next: StatBlock) => void }) {
  function set<K extends keyof StatBlock>(key: K, val: StatBlock[K]) {
    onChange({ ...value, [key]: val });
  }

  return (
    <div className="stat-block-editor">
      <div className="editor-grid">
        <label className="field">
          <span>Size</span>
          <input type="text" value={value.size} onChange={(e) => set("size", e.target.value)} />
        </label>
        <label className="field">
          <span>Creature Type</span>
          <input type="text" value={value.creatureType} onChange={(e) => set("creatureType", e.target.value)} />
        </label>
        <label className="field">
          <span>Armor Class</span>
          <input type="number" value={value.armorClass} onChange={(e) => set("armorClass", Number(e.target.value))} />
        </label>
        <label className="field">
          <span>AC Note</span>
          <input type="text" value={value.armorClassNote ?? ""} onChange={(e) => set("armorClassNote", e.target.value || undefined)} />
        </label>
        <label className="field">
          <span>Hit Points</span>
          <input type="number" value={value.hitPointsAverage} onChange={(e) => set("hitPointsAverage", Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Hit Dice</span>
          <input type="text" value={value.hitDiceFormula} onChange={(e) => set("hitDiceFormula", e.target.value)} />
        </label>
        <label className="field">
          <span>Speed</span>
          <input type="text" value={value.speed} onChange={(e) => set("speed", e.target.value)} />
        </label>
        <label className="field">
          <span>Challenge Rating</span>
          <input type="text" value={value.challengeRating} onChange={(e) => set("challengeRating", e.target.value)} />
        </label>
        <label className="field">
          <span>Proficiency Bonus</span>
          <input type="number" value={value.proficiencyBonus} onChange={(e) => set("proficiencyBonus", Number(e.target.value))} />
        </label>
        <label className="field">
          <span>XP</span>
          <input type="number" value={value.xp} onChange={(e) => set("xp", Number(e.target.value))} />
        </label>
      </div>

      <div className="ability-grid editable">
        {ABILITY_ORDER.map(({ key, label }) => (
          <label className="field ability-field" key={key}>
            <span>{label}</span>
            <input
              type="number"
              value={value.abilityScores[key]}
              onChange={(e) => set("abilityScores", { ...value.abilityScores, [key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>

      <label className="field">
        <span>Saving Throws</span>
        <input type="text" value={value.savingThrows ?? ""} onChange={(e) => set("savingThrows", e.target.value || undefined)} />
      </label>
      <label className="field">
        <span>Skills</span>
        <input type="text" value={value.skills ?? ""} onChange={(e) => set("skills", e.target.value || undefined)} />
      </label>
      <label className="field">
        <span>Damage Resistances</span>
        <input type="text" value={value.damageResistances ?? ""} onChange={(e) => set("damageResistances", e.target.value || undefined)} />
      </label>
      <label className="field">
        <span>Damage Immunities</span>
        <input type="text" value={value.damageImmunities ?? ""} onChange={(e) => set("damageImmunities", e.target.value || undefined)} />
      </label>
      <label className="field">
        <span>Condition Immunities</span>
        <input type="text" value={value.conditionImmunities ?? ""} onChange={(e) => set("conditionImmunities", e.target.value || undefined)} />
      </label>
      <label className="field">
        <span>Senses</span>
        <input type="text" value={value.senses} onChange={(e) => set("senses", e.target.value)} />
      </label>
      <label className="field">
        <span>Languages</span>
        <input type="text" value={value.languages} onChange={(e) => set("languages", e.target.value)} />
      </label>

      <h4 className="section-heading">Traits</h4>
      <DynamicListEditor
        items={value.traits}
        onChange={(traits) => set("traits", traits)}
        fields={[{ key: "name", label: "Name" }, { key: "description", label: "Description", multiline: true }]}
        addLabel="+ Add Trait"
        emptyItem={{ name: "", description: "" }}
      />

      <h4 className="section-heading">Actions</h4>
      <DynamicListEditor
        items={value.actions}
        onChange={(actions) => set("actions", actions)}
        fields={[{ key: "name", label: "Name" }, { key: "description", label: "Description", multiline: true }]}
        addLabel="+ Add Action"
        emptyItem={{ name: "", description: "" }}
      />

      <h4 className="section-heading">Reactions</h4>
      <DynamicListEditor
        items={value.reactions ?? []}
        onChange={(reactions) => set("reactions", reactions)}
        fields={[{ key: "name", label: "Name" }, { key: "description", label: "Description", multiline: true }]}
        addLabel="+ Add Reaction"
        emptyItem={{ name: "", description: "" }}
      />
    </div>
  );
}
