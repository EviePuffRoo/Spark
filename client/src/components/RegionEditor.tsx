import { useState } from "react";
import type { GeneratedRegion } from "@spark/shared";

export function RegionEditor({
  value, onSave, onCancel, saveLabel = "Save Content",
}: {
  value: GeneratedRegion;
  onSave: (patch: GeneratedRegion) => Promise<void>;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof GeneratedRegion>(key: K, val: GeneratedRegion[K]) {
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
          <span>Terrain</span>
          <input type="text" value={draft.terrainCategory} onChange={(e) => set("terrainCategory", e.target.value)} />
        </label>
        <label className="field">
          <span>Danger Level</span>
          <input type="text" value={draft.dangerLevel ?? ""} onChange={(e) => set("dangerLevel", e.target.value || undefined)} />
        </label>
      </div>
      <label className="field">
        <span>Description</span>
        <textarea rows={3} value={draft.description} onChange={(e) => set("description", e.target.value)} />
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
