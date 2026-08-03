import type { GeneratedFaction } from "@spark/shared";

export function FactionCardView({ faction }: { faction: GeneratedFaction }) {
  return (
    <div className="statblock item-card">
      <h2 className="statblock-name">{faction.name}</h2>
      <p className="statblock-subtitle">{faction.factionType}</p>
      <hr className="rule gold" />
      <h3 className="section-heading">Agenda</h3>
      <p>{faction.agenda}</p>
      <h3 className="section-heading">Methods</h3>
      <p>{faction.methods}</p>
      <h3 className="section-heading">Public Face</h3>
      <p>{faction.publicFace}</p>
      <h3 className="section-heading">Hook</h3>
      <p>{faction.hook}</p>
    </div>
  );
}
