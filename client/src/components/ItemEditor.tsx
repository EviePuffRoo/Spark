import { useState } from "react";
import type { GeneratedItem } from "@spark/shared";

export function ItemEditor({
  value, onSave, onCancel, saveLabel = "Save Content",
}: {
  value: GeneratedItem;
  onSave: (patch: GeneratedItem) => Promise<void>;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof GeneratedItem>(key: K, val: GeneratedItem[K]) {
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
          <span>Item Type</span>
          <input type="text" value={draft.itemType} onChange={(e) => set("itemType", e.target.value)} />
        </label>
        <label className="field">
          <span>Category</span>
          <input type="text" value={draft.category} onChange={(e) => set("category", e.target.value)} />
        </label>
        <label className="field">
          <span>Rarity</span>
          <input type="text" value={draft.rarity} onChange={(e) => set("rarity", e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Description</span>
        <textarea rows={2} value={draft.description} onChange={(e) => set("description", e.target.value)} />
      </label>
      <label className="field">
        <span>Property</span>
        <textarea rows={2} value={draft.property} onChange={(e) => set("property", e.target.value)} />
      </label>
      <label className="field">
        <span>History</span>
        <textarea rows={2} value={draft.history} onChange={(e) => set("history", e.target.value)} />
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
