import { useState } from "react";
import type { HouseRules } from "@spark/shared";
import { getRuleset } from "@spark/shared";
import { api, type WorldSummary } from "../api";

const BASE_RULESET = getRuleset();

const FIELDS: { key: keyof HouseRules; label: string; hint: string; defaultValue: number }[] = [
  {
    key: "pointBuyBudget", label: "Point-buy budget",
    hint: "Points available when assigning ability scores in the Character Creation wizard's Point Buy mode.",
    defaultValue: BASE_RULESET.pointBuyBudget,
  },
  {
    key: "carryCapacityMultiplier", label: "Carry capacity (lbs per STR point)",
    hint: "Carry capacity = Strength score × this number.",
    defaultValue: 15,
  },
  {
    key: "encounterDifficultyMultiplier", label: "Encounter difficulty multiplier",
    hint: "Scales every difficulty threshold (easy/medium/hard/deadly) before rating an encounter. Above 1 makes encounters read as easier; below 1, harder.",
    defaultValue: 1,
  },
];

export function HouseRulesPanel({ world, onUpdated }: { world: WorldSummary; onUpdated: () => void }) {
  const houseRules = world.houseRules ?? {};
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, houseRules[f.key]?.toString() ?? ""]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const activeCount = FIELDS.filter((f) => houseRules[f.key] !== undefined).length;

  if (!world.isOwner) {
    if (activeCount === 0) return null;
    return (
      <div className="panel">
        <h3 className="section-heading">House Rules</h3>
        <ul className="entity-list">
          {FIELDS.filter((f) => houseRules[f.key] !== undefined).map((f) => (
            <li key={f.key} className="world-row">
              <span className="entity-name">{f.label}</span>
              <span className="entity-meta">{houseRules[f.key]}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const next: HouseRules = {};
      for (const f of FIELDS) {
        const raw = draft[f.key];
        if (raw.trim() !== "") {
          const value = Number(raw);
          if (Number.isFinite(value) && value > 0) next[f.key] = value;
        }
      }
      await api.updateWorld(world.id, { houseRules: next });
      onUpdated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <div className="button-row" style={{ justifyContent: "space-between" }}>
        <h3 className="section-heading">
          House Rules{activeCount > 0 ? ` (${activeCount} active)` : ""}
        </h3>
        <button className="btn-secondary" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Edit"}
        </button>
      </div>
      {!open && activeCount === 0 && <p className="hint">Playing the ruleset as written — no overrides set.</p>}
      {open && (
        <>
          <p className="hint">Tune a handful of the ruleset's own numbers for this world. Leave a field blank to use the default.</p>
          {FIELDS.map((f) => (
            <label className="field" key={f.key}>
              <span>{f.label} <span className="entity-meta">(default {f.defaultValue})</span></span>
              <input
                type="number" min={0} step="any"
                value={draft[f.key]}
                placeholder={f.defaultValue.toString()}
                onChange={(e) => setDraft((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
              <span className="hint">{f.hint}</span>
            </label>
          ))}
          {error && <p className="error">{error}</p>}
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save House Rules"}</button>
        </>
      )}
    </div>
  );
}
