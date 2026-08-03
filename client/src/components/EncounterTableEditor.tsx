import { useState } from "react";
import type { GeneratedEncounterTable } from "@spark/shared";
import { DynamicListEditor } from "./DynamicListEditor";

export function EncounterTableEditor({
  value, onSave, onCancel, saveLabel = "Save Content",
}: {
  value: GeneratedEncounterTable;
  onSave: (patch: GeneratedEncounterTable) => Promise<void>;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof GeneratedEncounterTable>(key: K, val: GeneratedEncounterTable[K]) {
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
      <div className="editor-grid">
        <label className="field">
          <span>Name</span>
          <input type="text" value={draft.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="field">
          <span>Terrain</span>
          <input type="text" value={draft.terrain} onChange={(e) => set("terrain", e.target.value)} />
        </label>
      </div>

      <h4 className="section-heading">Entries</h4>
      <DynamicListEditor
        items={draft.entries}
        onChange={(entries) => set("entries", entries)}
        fields={[{ key: "roll", label: "Roll" }, { key: "description", label: "Description", multiline: true }]}
        addLabel="+ Add Entry"
        emptyItem={{ roll: "", description: "" }}
      />

      <div className="button-row editor-actions">
        <button className="btn-primary" onClick={handleSave} disabled={saving || draft.entries.length === 0}>
          {saving ? "Saving…" : saveLabel}
        </button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
