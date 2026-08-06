import { useEffect, useState } from "react";
import type { GeneratedEncounterTable } from "@spark/shared";
import { rollTableIndex } from "../rollTable";

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

      <button className="btn-secondary" onClick={() => setRolledIndex(rollTableIndex(table.entries))}>
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
