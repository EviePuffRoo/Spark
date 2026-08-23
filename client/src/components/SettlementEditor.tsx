import { useState } from "react";
import type { GeneratedSettlement } from "@spark/shared";

export function SettlementEditor({
  value, onSave, onCancel, saveLabel = "Save Content",
}: {
  value: GeneratedSettlement;
  onSave: (patch: GeneratedSettlement) => Promise<void>;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof GeneratedSettlement>(key: K, val: GeneratedSettlement[K]) {
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
          <span>Settlement Type</span>
          <input type="text" value={draft.settlementType} onChange={(e) => set("settlementType", e.target.value)} />
        </label>
        <label className="field">
          <span>Population</span>
          <input type="text" value={draft.population ?? ""} onChange={(e) => set("population", e.target.value || undefined)} />
        </label>
      </div>
      <div className="editor-grid">
        <label className="field">
          <span>Prosperity</span>
          <input type="text" value={draft.prosperity ?? ""} onChange={(e) => set("prosperity", e.target.value || undefined)} />
        </label>
        <label className="field">
          <span>Danger Level</span>
          <input type="text" value={draft.dangerLevel ?? ""} onChange={(e) => set("dangerLevel", e.target.value || undefined)} />
        </label>
      </div>
      <label className="field">
        <span>Government</span>
        <input type="text" value={draft.government ?? ""} onChange={(e) => set("government", e.target.value || undefined)} />
      </label>
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
