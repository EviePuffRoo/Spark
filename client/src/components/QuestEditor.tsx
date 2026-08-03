import { useState } from "react";
import type { GeneratedQuestHook } from "@spark/shared";

export function QuestEditor({
  value, onSave, onCancel, saveLabel = "Save Content",
}: {
  value: GeneratedQuestHook;
  onSave: (patch: GeneratedQuestHook) => Promise<void>;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof GeneratedQuestHook>(key: K, val: GeneratedQuestHook[K]) {
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
        <span>Title</span>
        <input type="text" value={draft.title} onChange={(e) => set("title", e.target.value)} />
      </label>
      <div className="editor-grid">
        <label className="field">
          <span>Quest Type</span>
          <input type="text" value={draft.questType} onChange={(e) => set("questType", e.target.value)} />
        </label>
        <label className="field">
          <span>Tier</span>
          <input type="text" value={draft.tier} onChange={(e) => set("tier", e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Hook</span>
        <textarea rows={2} value={draft.hook} onChange={(e) => set("hook", e.target.value)} />
      </label>
      <label className="field">
        <span>Objective</span>
        <textarea rows={2} value={draft.objective} onChange={(e) => set("objective", e.target.value)} />
      </label>
      <label className="field">
        <span>Complication</span>
        <textarea rows={2} value={draft.complication} onChange={(e) => set("complication", e.target.value)} />
      </label>
      <label className="field">
        <span>Reward</span>
        <textarea rows={2} value={draft.reward} onChange={(e) => set("reward", e.target.value)} />
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
