import { useState } from "react";
import type { GeneratedLocation } from "@spark/shared";

export function LocationEditor({
  value, onSave, onCancel, saveLabel = "Save Content",
}: {
  value: GeneratedLocation;
  onSave: (patch: GeneratedLocation) => Promise<void>;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof GeneratedLocation>(key: K, val: GeneratedLocation[K]) {
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
      <div className="editor-grid">
        <label className="field">
          <span>Location Type</span>
          <input type="text" value={draft.locationType} onChange={(e) => set("locationType", e.target.value)} />
        </label>
        <label className="field">
          <span>Category</span>
          <input type="text" value={draft.category} onChange={(e) => set("category", e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Description</span>
        <textarea rows={2} value={draft.description} onChange={(e) => set("description", e.target.value)} />
      </label>
      <label className="field">
        <span>Notable Feature</span>
        <textarea rows={2} value={draft.notableFeature} onChange={(e) => set("notableFeature", e.target.value)} />
      </label>
      <label className="field">
        <span>Who's Here</span>
        <textarea rows={2} value={draft.keeper} onChange={(e) => set("keeper", e.target.value)} />
      </label>
      <label className="field">
        <span>Rumor</span>
        <textarea rows={2} value={draft.rumor} onChange={(e) => set("rumor", e.target.value)} />
      </label>

      <div className="button-row editor-actions">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : saveLabel}
        </button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
