import { useEffect, useState } from "react";
import type { RollLogEntry, LiveCombatant } from "@spark/shared";
import { RECENT_HISTORY_LIMIT } from "@spark/shared";
import { api, type WorldSummary } from "../api";
import { useAuth } from "../AuthContext";
import { useLocalStorage } from "../useLocalStorage";
import { useWorldLiveChannel } from "../useWorldLiveChannel";

interface RollRecord {
  id: string;
  notation: string;
  results: number[];
  modifier: number;
  total: number;
  timestamp?: number;
  label?: string;
  mode?: "adv" | "dis";
}

const PRESETS = [4, 6, 8, 10, 12, 20, 100];
const HISTORY_LIMIT = 50;

export function parseNotation(input: string): { count: number; sides: number; modifier: number } | null {
  const match = input.trim().match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return null;
  const count = match[1] ? Number(match[1]) : 1;
  const sides = Number(match[2]);
  const modifier = match[3] ? Number(match[3]) : 0;
  if (count < 1 || count > 100 || sides < 1) return null;
  return { count, sides, modifier };
}

export function rollDice(count: number, sides: number): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
}

export function timeAgo(ms?: number): string | null {
  if (!ms) return null;
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ms).toLocaleDateString();
}

export function DiceRoller({
  worlds, partyWorldId: selectedWorldId, setPartyWorldId: setSelectedWorldId, initialMode = "personal",
}: {
  worlds: WorldSummary[];
  partyWorldId: string;
  setPartyWorldId: (id: string) => void;
  initialMode?: "personal" | "party";
}) {
  const { user } = useAuth();
  const [history, setHistory] = useLocalStorage<RollRecord[]>("spark-dice-history", []);
  const [notation, setNotation] = useState("1d20");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"personal" | "party">(initialMode);
  const [rollerName, setRollerName] = useState(user?.displayName || user?.username || "");
  const [secret, setSecret] = useState(false);
  const [partyLog, setPartyLog] = useState<RollLogEntry[]>([]);
  const [partyError, setPartyError] = useState<string | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [olderRolls, setOlderRolls] = useState<RollLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyExhausted, setHistoryExhausted] = useState(false);
  const isPaid = user?.tier === "paid";

  const [applyOpenFor, setApplyOpenFor] = useState<string | null>(null);
  const [applyCombatants, setApplyCombatants] = useState<LiveCombatant[] | null>(null);
  const [applyTargetId, setApplyTargetId] = useState("");
  const [applyMode, setApplyMode] = useState<"damage" | "heal">("damage");
  const [applyError, setApplyError] = useState<string | null>(null);

  const [postedToChat, setPostedToChat] = useState<string | null>(null);

  const selectedWorld = worlds.find((w) => w.id === selectedWorldId) ?? null;

  useEffect(() => {
    if (mode !== "party" || !selectedWorldId) {
      setPartyLog([]);
      setApplyOpenFor(null);
    }
    // A world switch invalidates any loaded older history regardless of mode.
    setHistoryOpen(false);
    setOlderRolls([]);
    setHistoryExhausted(false);
    setHistoryError(null);
  }, [mode, selectedWorldId]);

  const { error: liveError } = useWorldLiveChannel(mode === "party" ? selectedWorldId : null, { onRollLog: setPartyLog });
  useEffect(() => { setPartyError(liveError ?? null); }, [liveError]);

  async function loadOlderRolls() {
    if (!selectedWorldId || historyLoading) return;
    const cursor = olderRolls.length > 0 ? olderRolls[olderRolls.length - 1].id : partyLog[partyLog.length - 1]?.id;
    if (!cursor) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const rows = await api.loadOlderRollLog(selectedWorldId, cursor);
      if (rows.length === 0) setHistoryExhausted(true);
      setOlderRolls((prev) => [...prev, ...rows]);
    } catch (e) {
      setHistoryError((e as Error).message);
    } finally {
      setHistoryLoading(false);
    }
  }

  function toggleHistory() {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    if (isPaid && olderRolls.length === 0 && !historyExhausted) loadOlderRolls();
  }

  function pushLocalRecord(record: RollRecord) {
    setHistory((h) => [record, ...h].slice(0, HISTORY_LIMIT));
  }

  async function postPartyRoll(payload: {
    notation: string; results: number[]; modifier: number; total: number; mode?: "adv" | "dis"; label?: string;
  }) {
    if (!selectedWorldId || !user) return;
    setPartyError(null);
    try {
      const row = await api.postRollLogEntry({
        worldId: selectedWorldId,
        rollerName: rollerName.trim() || user.displayName || user.username,
        hiddenFromParty: secret,
        ...payload,
      });
      setPartyLog((log) => [row, ...log].slice(0, 100));
    } catch (e) {
      setPartyError((e as Error).message);
    }
  }

  function performRoll(input: string, rollLabel?: string) {
    const parsed = parseNotation(input);
    if (!parsed) {
      setError(`Can't parse "${input}". Try something like 1d20 or 2d6+3.`);
      return;
    }
    setError(null);
    const results = rollDice(parsed.count, parsed.sides);
    const total = results.reduce((sum, r) => sum + r, 0) + parsed.modifier;
    const trimmedLabel = rollLabel?.trim() || undefined;

    if (mode === "party") {
      postPartyRoll({ notation: input.trim(), results, modifier: parsed.modifier, total, label: trimmedLabel });
    } else {
      pushLocalRecord({
        id: crypto.randomUUID(), notation: input.trim(), results, modifier: parsed.modifier, total,
        timestamp: Date.now(), label: trimmedLabel,
      });
    }
    if (rollLabel) setLabel("");
  }

  function rollAdvantage(advMode: "adv" | "dis") {
    const results = rollDice(2, 20);
    const kept = advMode === "adv" ? Math.max(...results) : Math.min(...results);

    if (mode === "party") {
      postPartyRoll({ notation: "1d20", results, modifier: 0, total: kept, mode: advMode });
    } else {
      pushLocalRecord({
        id: crypto.randomUUID(), notation: "1d20", results, modifier: 0, total: kept,
        timestamp: Date.now(), mode: advMode,
      });
    }
  }

  function deleteRecord(id: string) {
    setHistory((h) => h.filter((r) => r.id !== id));
  }

  async function deletePartyEntry(id: string) {
    setPartyError(null);
    try {
      await api.deleteRollLogEntry(id);
      setPartyLog((log) => log.filter((r) => r.id !== id));
    } catch (e) {
      setPartyError((e as Error).message);
    }
  }

  async function toggleApplyPicker(rollId: string) {
    if (applyOpenFor === rollId) {
      setApplyOpenFor(null);
      return;
    }
    setApplyOpenFor(rollId);
    setApplyCombatants(null);
    setApplyError(null);
    if (!selectedWorldId) return;
    try {
      const encounter = await api.getEncounter(selectedWorldId);
      setApplyCombatants(encounter.combatants);
      setApplyTargetId(encounter.combatants[0]?.id ?? "");
    } catch (e) {
      setApplyError((e as Error).message);
    }
  }

  async function applyRollToCombat(roll: RollLogEntry) {
    if (!selectedWorldId || !applyTargetId) return;
    setApplyError(null);
    try {
      await api.adjustEncounterHp(selectedWorldId, applyTargetId, applyMode === "damage" ? -roll.total : roll.total);
      setApplyOpenFor(null);
    } catch (e) {
      setApplyError((e as Error).message);
    }
  }

  async function postRollToChat(roll: RollLogEntry) {
    if (!selectedWorldId) return;
    setApplyError(null);
    const modifierText = roll.modifier ? ` ${roll.modifier > 0 ? "+" : ""}${roll.modifier}` : "";
    const text = `🎲 ${roll.label ? `${roll.label}: ` : ""}${roll.notation}: [${roll.results.join(", ")}]${modifierText} = ${roll.total}`;
    try {
      await api.postChatMessage({
        worldId: selectedWorldId, text,
        roll: { notation: roll.notation, results: roll.results, modifier: roll.modifier, total: roll.total, label: roll.label },
      });
      setPostedToChat(roll.id);
      setTimeout(() => setPostedToChat((cur) => (cur === roll.id ? null : cur)), 2000);
    } catch (e) {
      setApplyError((e as Error).message);
    }
  }

  const partyMode = mode === "party";

  return (
    <div className="panel dice-roller">
      <h2>Dice Roller</h2>

      {worlds.length === 0 ? (
        <p className="hint">Create or join a world to roll with your party.</p>
      ) : (
        <div className="tabs dice-mode-toggle" role="tablist">
          <button role="tab" className={mode === "personal" ? "active" : ""} aria-selected={mode === "personal"} onClick={() => setMode("personal")}>Personal</button>
          <button role="tab" className={partyMode ? "active" : ""} aria-selected={partyMode} onClick={() => setMode("party")}>Party</button>
        </div>
      )}

      {partyMode && worlds.length > 0 && (
        <>
          <label className="field">
            <span>World</span>
            <select value={selectedWorldId} onChange={(e) => setSelectedWorldId(e.target.value)}>
              <option value="">Select a world…</option>
              {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          {selectedWorldId && (
            <label className="field">
              <span>Rolling as</span>
              <input type="text" value={rollerName} onChange={(e) => setRollerName(e.target.value)} placeholder={user?.displayName || user?.username} />
            </label>
          )}
          {partyError && <p className="error">{partyError}</p>}
        </>
      )}

      <div className="dice-presets">
        {PRESETS.map((sides) => (
          <button key={sides} className="btn-secondary" onClick={() => performRoll(`1d${sides}`)}>d{sides}</button>
        ))}
        <button className="btn-secondary" onClick={() => rollAdvantage("adv")}>d20 Adv</button>
        <button className="btn-secondary" onClick={() => rollAdvantage("dis")}>d20 Dis</button>
      </div>

      <label className="field">
        <span>Custom roll</span>
        <div className="dice-input-row">
          <input
            type="text"
            value={notation}
            onChange={(e) => setNotation(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") performRoll(notation, label); }}
            placeholder="e.g. 2d6+3"
          />
          <button className="btn-primary" onClick={() => performRoll(notation, label)}>Roll</button>
        </div>
      </label>
      <label className="field">
        <span>Label (optional)</span>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") performRoll(notation, label); }}
          placeholder="e.g. Attack vs Goblin"
        />
      </label>
      {partyMode && selectedWorld?.canWrite && (
        <label className="field">
          <input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} />
          {" "}Secret (DM only, hidden from players)
        </label>
      )}
      {error && <p className="error">{error}</p>}

      {!partyMode && history.length > 0 && (
        <>
          <h3 className="section-heading">Recent Rolls</h3>
          <ul className="dice-history">
            {history.map((r) => (
              <li key={r.id} className="dice-history-row">
                <div className="dice-history-main">
                  <span className="entity-name">
                    {r.notation}
                    {r.mode && <span className="entity-meta"> ({r.mode === "adv" ? "adv" : "dis"})</span>}
                    {r.label && <span className="entity-meta"> · {r.label}</span>}
                  </span>
                  <button className="dice-history-delete" onClick={() => deleteRecord(r.id)} aria-label={`Delete roll ${r.notation}${r.label ? ` (${r.label})` : ""}`}>×</button>
                </div>
                <span className="entity-meta">
                  [{r.results.join(", ")}]{r.modifier ? ` ${r.modifier > 0 ? "+" : ""}${r.modifier}` : ""} = <strong className="dice-total mono">{r.total}</strong>
                  {timeAgo(r.timestamp) && <span className="dice-history-time"> · {timeAgo(r.timestamp)}</span>}
                </span>
              </li>
            ))}
          </ul>
          <button className="btn-secondary" onClick={() => setHistory([])}>Clear History</button>
        </>
      )}

      {partyMode && selectedWorldId && (
        <>
          <h3 className="section-heading">Party Log</h3>
          {partyLog.length === 0 && <p className="hint">No rolls yet. Be the first.</p>}
          <ul className="dice-history">
            {partyLog.map((r) => {
              const canDelete = r.userId === user?.id || selectedWorld?.canWrite;
              return (
                <li key={r.id} className="dice-history-row">
                  <div className="dice-history-main">
                    <span className="entity-name">
                      {r.rollerName}: {r.notation}
                      {r.mode && <span className="entity-meta"> ({r.mode === "adv" ? "adv" : "dis"})</span>}
                      {r.label && <span className="entity-meta"> · {r.label}</span>}
                      {r.hiddenFromParty && <span className="dice-history-secret">secret</span>}
                    </span>
                    {canDelete && (
                      <button className="dice-history-delete" onClick={() => deletePartyEntry(r.id)} aria-label={`Delete roll by ${r.rollerName}`}>×</button>
                    )}
                  </div>
                  <span className="entity-meta">
                    [{r.results.join(", ")}]{r.modifier ? ` ${r.modifier > 0 ? "+" : ""}${r.modifier}` : ""} = <strong className="dice-total mono">{r.total}</strong>
                    <span className="dice-history-time"> · {timeAgo(new Date(r.createdAt).getTime())}</span>
                  </span>
                  <div className="button-row">
                    <button className="btn-secondary" aria-expanded={applyOpenFor === r.id} onClick={() => toggleApplyPicker(r.id)}>
                      Apply to Combat
                    </button>
                    <button className="btn-secondary" onClick={() => postRollToChat(r)}>
                      {postedToChat === r.id ? "Posted!" : "Post to Chat"}
                    </button>
                  </div>
                  {applyOpenFor === r.id && (
                    <div className="save-panel apply-to-combat-panel">
                      {applyError && <p className="error">{applyError}</p>}
                      {!applyError && applyCombatants === null && <p className="hint">Loading combatants…</p>}
                      {applyCombatants !== null && applyCombatants.length === 0 && <p className="hint">No active encounter for this world.</p>}
                      {applyCombatants !== null && applyCombatants.length > 0 && (
                        <>
                          <label className="field">
                            <span>Apply to</span>
                            <select value={applyTargetId} onChange={(e) => setApplyTargetId(e.target.value)}>
                              {applyCombatants.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </label>
                          <div className="tabs apply-mode-toggle" role="tablist">
                            <button role="tab" className={applyMode === "damage" ? "active" : ""} aria-selected={applyMode === "damage"} onClick={() => setApplyMode("damage")}>Damage</button>
                            <button role="tab" className={applyMode === "heal" ? "active" : ""} aria-selected={applyMode === "heal"} onClick={() => setApplyMode("heal")}>Heal</button>
                          </div>
                          <button className="btn-primary" onClick={() => applyRollToCombat(r)}>
                            Apply {r.total} {applyMode === "damage" ? "Damage" : "Healing"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="button-row">
            <button className="btn-secondary" onClick={toggleHistory} aria-expanded={historyOpen}>
              {historyOpen ? "Hide Full History" : "View Full History"}
            </button>
          </div>

          {historyOpen && !isPaid && (
            <p className="hint">Full history beyond the last {RECENT_HISTORY_LIMIT} rolls is a paid feature. See Billing to upgrade.</p>
          )}

          {historyOpen && isPaid && (
            <>
              <ul className="dice-history older-history">
                {olderRolls.map((r) => (
                  <li key={r.id} className="dice-history-row">
                    <span className="entity-name">
                      {r.rollerName}: {r.notation}
                      {r.mode && <span className="entity-meta"> ({r.mode === "adv" ? "adv" : "dis"})</span>}
                      {r.label && <span className="entity-meta"> · {r.label}</span>}
                    </span>
                    <span className="entity-meta">
                      [{r.results.join(", ")}]{r.modifier ? ` ${r.modifier > 0 ? "+" : ""}${r.modifier}` : ""} = <strong className="dice-total mono">{r.total}</strong>
                      <span className="dice-history-time"> · {timeAgo(new Date(r.createdAt).getTime())}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {historyError && <p className="error">{historyError}</p>}
              {!historyExhausted && (
                <button className="btn-secondary" onClick={loadOlderRolls} disabled={historyLoading}>
                  {historyLoading ? "Loading…" : "Load More"}
                </button>
              )}
              {historyExhausted && olderRolls.length === 0 && <p className="hint">No older rolls.</p>}
              {historyExhausted && olderRolls.length > 0 && <p className="hint">That's the full history.</p>}
            </>
          )}
        </>
      )}
    </div>
  );
}
