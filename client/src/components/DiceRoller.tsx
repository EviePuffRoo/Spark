import { useState } from "react";
import { useLocalStorage } from "../useLocalStorage";

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

function parseNotation(input: string): { count: number; sides: number; modifier: number } | null {
  const match = input.trim().match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return null;
  const count = match[1] ? Number(match[1]) : 1;
  const sides = Number(match[2]);
  const modifier = match[3] ? Number(match[3]) : 0;
  if (count < 1 || count > 100 || sides < 1) return null;
  return { count, sides, modifier };
}

function rollDice(count: number, sides: number): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
}

function timeAgo(ms?: number): string | null {
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

export function DiceRoller() {
  const [history, setHistory] = useLocalStorage<RollRecord[]>("spark-dice-history", []);
  const [notation, setNotation] = useState("1d20");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  function pushRecord(record: RollRecord) {
    setHistory((h) => [record, ...h].slice(0, HISTORY_LIMIT));
  }

  function performRoll(input: string, rollLabel?: string) {
    const parsed = parseNotation(input);
    if (!parsed) {
      setError(`Can't parse "${input}" — try something like 1d20 or 2d6+3.`);
      return;
    }
    setError(null);
    const results = rollDice(parsed.count, parsed.sides);
    const total = results.reduce((sum, r) => sum + r, 0) + parsed.modifier;
    pushRecord({
      id: crypto.randomUUID(),
      notation: input.trim(),
      results,
      modifier: parsed.modifier,
      total,
      timestamp: Date.now(),
      label: rollLabel?.trim() || undefined,
    });
    if (rollLabel) setLabel("");
  }

  function rollAdvantage(mode: "adv" | "dis") {
    const results = rollDice(2, 20);
    const kept = mode === "adv" ? Math.max(...results) : Math.min(...results);
    pushRecord({
      id: crypto.randomUUID(),
      notation: "1d20",
      results,
      modifier: 0,
      total: kept,
      timestamp: Date.now(),
      mode,
    });
  }

  function deleteRecord(id: string) {
    setHistory((h) => h.filter((r) => r.id !== id));
  }

  return (
    <div className="panel dice-roller">
      <h2>Dice Roller</h2>

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
      {error && <p className="error">{error}</p>}

      {history.length > 0 && (
        <>
          <h3 className="section-heading">Recent Rolls</h3>
          <ul className="dice-history">
            {history.map((r) => (
              <li key={r.id} className="dice-history-row">
                <div className="dice-history-main">
                  <span className="entity-name">
                    {r.notation}
                    {r.mode && <span className="entity-meta"> ({r.mode === "adv" ? "adv" : "dis"})</span>}
                    {r.label && <span className="entity-meta"> — {r.label}</span>}
                  </span>
                  <button className="dice-history-delete" onClick={() => deleteRecord(r.id)} aria-label={`Delete roll ${r.notation}${r.label ? ` (${r.label})` : ""}`}>×</button>
                </div>
                <span className="entity-meta">
                  [{r.results.join(", ")}]{r.modifier ? ` ${r.modifier > 0 ? "+" : ""}${r.modifier}` : ""} = <strong>{r.total}</strong>
                  {timeAgo(r.timestamp) && <span className="dice-history-time"> · {timeAgo(r.timestamp)}</span>}
                </span>
              </li>
            ))}
          </ul>
          <button className="btn-secondary" onClick={() => setHistory([])}>Clear History</button>
        </>
      )}
    </div>
  );
}
