import type { GeneratedEncounterTable } from "@spark/shared";

export function EncounterTableCardView({ table }: { table: GeneratedEncounterTable }) {
  return (
    <div className="statblock item-card">
      <h2 className="statblock-name">{table.name}</h2>
      <p className="statblock-subtitle">{table.terrain} &middot; roll d{table.entries.length}</p>
      <hr className="rule gold" />
      <table className="encounter-table">
        <tbody>
          {table.entries.map((entry) => (
            <tr key={entry.roll}>
              <td className="encounter-roll">{entry.roll}</td>
              <td>{entry.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
