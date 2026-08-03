import { useEffect, useState } from "react";
import type { GeneratedEncounterTable } from "@spark/shared";

// Most tables are one entry per face, but a hand-edited entry could use a
// range like "3-5" instead of a single value - weight rolls accordingly so a
// quick-roll still reflects real odds either way.
function rollWeight(roll: string): number {
  const match = roll.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
  if (!match) return 1;
  const lo = Number(match[1]);
  const hi = Number(match[2]);
  return Math.max(1, hi - lo + 1);
}

function rollIndex(entries: { roll: string }[]): number {
  const weights = entries.map((e) => rollWeight(e.roll));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < entries.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return entries.length - 1;
}

export function EncounterTableCardView({ table }: { table: GeneratedEncounterTable }) {
  const [rolledIndex, setRolledIndex] = useState<number | null>(null);

  useEffect(() => {
    setRolledIndex(null);
  }, [table]);

  const rolled = rolledIndex !== null ? table.entries[rolledIndex] : null;

  return (
    <div className="statblock item-card">
      <h2 className="statblock-name">{table.name}</h2>
      <p className="statblock-subtitle">{table.terrain} &middot; roll d{table.entries.length}</p>
      <hr className="rule gold" />

      <button className="btn-secondary" onClick={() => setRolledIndex(rollIndex(table.entries))}>
        Roll on this Table
      </button>
      {rolled && (
        <p className="encounter-roll-result" role="status">
          Rolled <strong>{rolled.roll}</strong>: {rolled.description}
        </p>
      )}

      <table className="encounter-table">
        <tbody>
          {table.entries.map((entry, index) => (
            <tr key={entry.roll + index} className={index === rolledIndex ? "encounter-roll-active" : ""}>
              <td className="encounter-roll">{entry.roll}</td>
              <td>{entry.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
