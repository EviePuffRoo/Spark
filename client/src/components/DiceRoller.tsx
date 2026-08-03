import { useState } from "react";
import { useLocalStorage } from "../useLocalStorage";

interface RollRecord {
  id: string;
  notation: string;
  results: number[];
  modifier: number;
  total: number;
}

const PRESETS = [4, 6, 8, 10, 12, 20, 100];

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

export function DiceRoller() {
  const [history, setHistory] = useLocalStorage<RollRecord[]>("spark-dice-history", []);
  const [notation, setNotation] = useState("1d20");
  const [error, setError] = useState<string | null>(null);

  function performRoll(input: string) {
    const parsed = parseNotation(input);
    if (!parsed) {
      setError(`Can't parse "${input}" — try something like 1d20 or 2d6+3.`);
      return;
    }
    setError(null);
    const results = rollDice(parsed.count, parsed.sides);
    const total = results.reduce((sum, r) => sum + r, 0) + parsed.modifier;
    const record: RollRecord = { id: crypto.randomUUID(), notation: input.trim(), results, modifier: parsed.modifier, total };
    setHistory((h) => [record, ...h].slice(0, 10));
  }

  return (
    <div className="panel dice-roller">
      <h2>Dice Roller</h2>

      <div className="dice-presets">
        {PRESETS.map((sides) => (
          <button key={sides} className="btn-secondary" onClick={() => performRoll(`1d${sides}`)}>d{sides}</button>
        ))}
      </div>

      <label className="field">
        <span>Custom roll</span>
        <div className="dice-input-row">
          <input
            type="text"
            value={notation}
            onChange={(e) => setNotation(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") performRoll(notation); }}
            placeholder="e.g. 2d6+3"
          />
          <button className="btn-primary" onClick={() => performRoll(notation)}>Roll</button>
        </div>
      </label>
      {error && <p className="error">{error}</p>}

      {history.length > 0 && (
        <>
          <h3 className="section-heading">Recent Rolls</h3>
          <ul className="dice-history">
            {history.map((r) => (
              <li key={r.id} className="dice-history-row">
                <span className="entity-name">{r.notation}</span>
                <span className="entity-meta">
                  [{r.results.join(", ")}]{r.modifier ? ` ${r.modifier > 0 ? "+" : ""}${r.modifier}` : ""} = <strong>{r.total}</strong>
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
