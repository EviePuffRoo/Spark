import type { GeneratedAdventure } from "@spark/shared";

export function AdventureCardView({ adventure }: { adventure: GeneratedAdventure }) {
  return (
    <div className="statblock item-card">
      <h2 className="statblock-name">{adventure.title}</h2>
      <p className="statblock-subtitle">{adventure.tier}</p>
      <hr className="rule gold" />
      <p className="adventure-premise">{adventure.premise}</p>
      <h3 className="section-heading">Hook</h3>
      <p>{adventure.hook}</p>
      <h3 className="section-heading">Objective</h3>
      <p>{adventure.objective}</p>
      <h3 className="section-heading">Complication</h3>
      <p>{adventure.complication}</p>
      <h3 className="section-heading">Reward</h3>
      <p>{adventure.reward}</p>
    </div>
  );
}
