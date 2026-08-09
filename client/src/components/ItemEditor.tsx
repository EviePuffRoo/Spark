import { useState } from "react";
import type { GeneratedItem, ItemBonusType } from "@spark/shared";
import { ITEM_RARITY_TIER_INFO, ITEM_BONUS_TYPE_LABELS } from "@spark/shared";

const BONUS_TYPES = Object.keys(ITEM_BONUS_TYPE_LABELS) as ItemBonusType[];

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

  function setRarityTier(tier: number) {
    const info = ITEM_RARITY_TIER_INFO[tier];
    const midpoint = Math.round((info.valueRange[0] + info.valueRange[1]) / 2);
    setDraft({ ...draft, rarityTier: tier, rarity: info.label, value: midpoint });
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
          <select value={draft.rarityTier} onChange={(e) => setRarityTier(Number(e.target.value))}>
            {ITEM_RARITY_TIER_INFO.map((info) => <option key={info.tier} value={info.tier}>{info.label}</option>)}
          </select>
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

      <div className="editor-grid">
        <label className="field">
          <span>Bonus applies to</span>
          <select value={draft.bonusType} onChange={(e) => set("bonusType", e.target.value as ItemBonusType)}>
            {BONUS_TYPES.map((t) => <option key={t} value={t}>{ITEM_BONUS_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Bonus value</span>
          <input
            type="number" min={0} max={5}
            value={draft.bonusValue}
            disabled={draft.bonusType === "none"}
            onChange={(e) => set("bonusValue", Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Value (gp)</span>
          <input type="number" min={0} value={draft.value} onChange={(e) => set("value", Number(e.target.value))} />
        </label>
      </div>
      <label className="field">
        <input
          type="checkbox"
          checked={draft.requiresAttunement}
          onChange={(e) => set("requiresAttunement", e.target.checked)}
        />
        {" "}Requires attunement
      </label>
      <div className="editor-grid">
        <label className="field">
          <span>Charges (optional)</span>
          <input
            type="number" min={0}
            value={draft.charges ?? ""}
            onChange={(e) => set("charges", e.target.value === "" ? null : Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Recharge rule (optional)</span>
          <input
            type="text"
            value={draft.rechargeRule ?? ""}
            onChange={(e) => set("rechargeRule", e.target.value || null)}
            placeholder="Regains all charges after a long rest."
          />
        </label>
      </div>

      <div className="button-row editor-actions">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : saveLabel}
        </button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
