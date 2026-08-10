import type { GeneratedRegion } from "@spark/shared";

export function RegionCardView({ region }: { region: GeneratedRegion }) {
  return (
    <div className="statblock item-card">
      <h2 className="statblock-name">{region.name}</h2>
      <p className="statblock-subtitle">{region.terrainCategory}{region.dangerLevel ? ` · ${region.dangerLevel}` : ""}</p>
      <hr className="rule gold" />
      <p>{region.description}</p>
    </div>
  );
}
