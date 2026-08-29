import { useState } from "react";
import type { TriggerRule, TriggerCondition, TriggerConditionKind, CombatantKind } from "@spark/shared";
import { api } from "../api";
import { useWorldLiveChannel } from "../useWorldLiveChannel";

const CONDITION_LABELS: Record<TriggerConditionKind, string> = {
  hpBelowPercent: "HP falls to or below a % of max",
  hpBelowValue: "HP falls to or below a value",
  conditionApplied: "A condition is applied",
  roundReached: "Combat reaches a round",
};

const TARGET_LABELS: Record<CombatantKind, string> = {
  monster: "Monsters", playerCharacter: "Player characters", custom: "Custom entries",
};

function describeCondition(condition: TriggerCondition): string {
  const target = condition.targetKind ? ` (${TARGET_LABELS[condition.targetKind]}${condition.namePattern ? ` named "${condition.namePattern}"` : ""})`
    : condition.namePattern ? ` (named "${condition.namePattern}")` : "";
  if (condition.kind === "hpBelowPercent") return `HP ≤ ${condition.threshold ?? 0}%${target}`;
  if (condition.kind === "hpBelowValue") return `HP ≤ ${condition.threshold ?? 0}${target}`;
  if (condition.kind === "conditionApplied") return `"${condition.conditionName ?? ""}" applied${target}`;
  return `Round ${condition.threshold ?? 0} reached`;
}

interface Draft {
  name: string;
  kind: TriggerConditionKind;
  threshold: string;
  conditionName: string;
  targetKind: "" | CombatantKind;
  namePattern: string;
  message: string;
  announceInChat: boolean;
}

const BLANK_DRAFT: Draft = {
  name: "", kind: "hpBelowPercent", threshold: "50", conditionName: "", targetKind: "", namePattern: "",
  message: "", announceInChat: false,
};

function draftToCondition(d: Draft): TriggerCondition {
  const condition: TriggerCondition = { kind: d.kind };
  if (d.kind === "hpBelowPercent" || d.kind === "hpBelowValue" || d.kind === "roundReached") {
    condition.threshold = Number(d.threshold) || 0;
  }
  if (d.kind === "conditionApplied") condition.conditionName = d.conditionName.trim();
  if (d.kind !== "roundReached") {
    if (d.targetKind) condition.targetKind = d.targetKind;
    if (d.namePattern.trim()) condition.namePattern = d.namePattern.trim();
  }
  return condition;
}

// Full CRUD for the world's owner; a read-only list of enabled rules for
// everyone else — same "API response gates what's shown" pattern as
// DoomClockPanel, since a disabled rule is the DM's own draft.
export function TriggerRulesPanel({ worldId, canEdit }: { worldId: string; canEdit: boolean }) {
  const [rules, setRules] = useState<TriggerRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(BLANK_DRAFT);

  function refresh() {
    api.listTriggerRules(worldId).then(setRules).catch((e) => setError((e as Error).message));
  }

  useWorldLiveChannel(worldId, {
    onTriggerRules: (r) => { setRules(r); setLoading(false); },
  });

  async function createRule() {
    if (!draft.name.trim() || !draft.message.trim()) return;
    try {
      await api.createTriggerRule({
        worldId, name: draft.name.trim(), message: draft.message.trim(),
        condition: draftToCondition(draft), announceInChat: draft.announceInChat,
      });
      setDraft(BLANK_DRAFT);
      setCreating(false);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function toggleEnabled(rule: TriggerRule) {
    try {
      await api.updateTriggerRule(rule.id, { enabled: !rule.enabled });
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteTriggerRule(id);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!canEdit && !loading && rules.length === 0) return null;

  return (
    <div className="panel trigger-rules-panel">
      <h3 className="section-heading">Trigger Rules</h3>
      <p className="hint">A small set of "if X, remind me" watches for combat — not a script, just a condition and your own reminder text.</p>
      {loading && <p className="hint">Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && rules.length === 0 && canEdit && <p className="hint">No rules yet.</p>}

      <ul className="trigger-rules-list">
        {rules.map((rule) => (
          <li key={rule.id} className={`trigger-rule-row${rule.enabled ? "" : " disabled"}`}>
            <div className="trigger-rule-info">
              <span className="entity-name">{rule.name}{!rule.enabled && " (disabled)"}</span>
              <span className="entity-meta">{describeCondition(rule.condition)}</span>
              <span className="entity-meta">"{rule.message}"{rule.announceInChat ? " · also posts to chat" : ""}</span>
            </div>
            {canEdit && (
              <div className="button-row">
                <button className="btn-secondary" onClick={() => toggleEnabled(rule)}>{rule.enabled ? "Disable" : "Enable"}</button>
                <button className="btn-danger" onClick={() => remove(rule.id)}>Delete</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        creating ? (
          <div className="save-panel">
            <label className="field">
              <span>Name</span>
              <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Boss bloodied" />
            </label>
            <label className="field">
              <span>Condition</span>
              <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as TriggerConditionKind })}>
                {(Object.keys(CONDITION_LABELS) as TriggerConditionKind[]).map((k) => (
                  <option key={k} value={k}>{CONDITION_LABELS[k]}</option>
                ))}
              </select>
            </label>
            {(draft.kind === "hpBelowPercent" || draft.kind === "hpBelowValue" || draft.kind === "roundReached") && (
              <label className="field">
                <span>{draft.kind === "roundReached" ? "Round" : draft.kind === "hpBelowPercent" ? "Percent" : "HP"}</span>
                <input type="number" min={0} value={draft.threshold} onChange={(e) => setDraft({ ...draft, threshold: e.target.value })} />
              </label>
            )}
            {draft.kind === "conditionApplied" && (
              <label className="field">
                <span>Condition name</span>
                <input type="text" value={draft.conditionName} onChange={(e) => setDraft({ ...draft, conditionName: e.target.value })} placeholder="e.g. Poisoned" />
              </label>
            )}
            {draft.kind !== "roundReached" && (
              <>
                <label className="field">
                  <span>Limit to (optional)</span>
                  <select value={draft.targetKind} onChange={(e) => setDraft({ ...draft, targetKind: e.target.value as Draft["targetKind"] })}>
                    <option value="">Any combatant</option>
                    {(Object.keys(TARGET_LABELS) as CombatantKind[]).map((k) => (
                      <option key={k} value={k}>{TARGET_LABELS[k]}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Name contains (optional)</span>
                  <input type="text" value={draft.namePattern} onChange={(e) => setDraft({ ...draft, namePattern: e.target.value })} placeholder="e.g. Lich" />
                </label>
              </>
            )}
            <label className="field">
              <span>Reminder message</span>
              <textarea value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} rows={2} placeholder="What should this remind you to do?" />
            </label>
            <label className="field">
              <input type="checkbox" checked={draft.announceInChat} onChange={(e) => setDraft({ ...draft, announceInChat: e.target.checked })} />
              {" "}Also post to world chat when I act on it
            </label>
            <div className="button-row">
              <button className="btn-primary" onClick={createRule}>Create Rule</button>
              <button className="btn-secondary" onClick={() => { setCreating(false); setDraft(BLANK_DRAFT); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn-secondary" onClick={() => setCreating(true)}>+ New Trigger Rule</button>
        )
      )}
    </div>
  );
}
