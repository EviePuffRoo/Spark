import { useState } from "react";
import type { Character, StatBlock, Backstory } from "@spark/shared";
import { StatBlockEditor } from "./StatBlockEditor";
import { BackstoryEditor } from "./BackstoryEditor";

export interface CharacterContentPatch {
  name: string;
  race?: string;
  background?: string;
  alignment: string;
  statBlock: StatBlock;
  backstory: Backstory;
}

export function CharacterEditor({
  character, onSave, onCancel,
}: {
  character: Character;
  onSave: (patch: CharacterContentPatch) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(character.name);
  const [race, setRace] = useState(character.race ?? "");
  const [background, setBackground] = useState(character.background ?? "");
  const [alignment, setAlignment] = useState(character.alignment);
  const [statBlock, setStatBlock] = useState(character.statBlock);
  const [backstory, setBackstory] = useState(character.backstory);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        name,
        race: race || undefined,
        background: background || undefined,
        alignment,
        statBlock: { ...statBlock, alignment },
        backstory,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="content-editor">
      <div className="editor-grid">
        <label className="field">
          <span>Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Race / Species</span>
          <input type="text" value={race} onChange={(e) => setRace(e.target.value)} />
        </label>
        <label className="field">
          <span>Background</span>
          <input type="text" value={background} onChange={(e) => setBackground(e.target.value)} />
        </label>
        <label className="field">
          <span>Alignment</span>
          <input type="text" value={alignment} onChange={(e) => setAlignment(e.target.value)} />
        </label>
      </div>

      <h3 className="section-heading">Stat Block</h3>
      <StatBlockEditor value={statBlock} onChange={setStatBlock} />

      <h3 className="section-heading">Backstory</h3>
      <BackstoryEditor value={backstory} onChange={setBackstory} />

      <div className="button-row editor-actions">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Content"}
        </button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
