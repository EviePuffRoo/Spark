import { useState } from "react";
import type { GeneratedFaction } from "@spark/shared";

export function FactionEditor({
  value, onSave, onCancel, saveLabel = "Save Content",
}: {
  value: GeneratedFaction;
  onSave: (patch: GeneratedFaction) => Promise<void>;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof GeneratedFaction>(key: K, val: GeneratedFaction[K]) {
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
        <span>Faction Type</span>
        <input type="text" value={draft.factionType} onChange={(e) => set("factionType", e.target.value)} />
      </label>
      <label className="field">
        <span>Agenda</span>
        <textarea rows={2} value={draft.agenda} onChange={(e) => set("agenda", e.target.value)} />
      </label>
      <label className="field">
        <span>Methods</span>
        <textarea rows={2} value={draft.methods} onChange={(e) => set("methods", e.target.value)} />
      </label>
      <label className="field">
        <span>Public Face</span>
        <textarea rows={2} value={draft.publicFace} onChange={(e) => set("publicFace", e.target.value)} />
      </label>
      <label className="field">
        <span>Hook</span>
        <textarea rows={2} value={draft.hook} onChange={(e) => set("hook", e.target.value)} />
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
