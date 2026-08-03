import type { GeneratedLocation } from "@spark/shared";

export function LocationCardView({ location }: { location: GeneratedLocation }) {
  return (
    <div className="statblock item-card">
      <h2 className="statblock-name">{location.name}</h2>
      <p className="statblock-subtitle">{location.category} &middot; {location.locationType}</p>
      <hr className="rule gold" />
      <p>{location.description}</p>
      <h3 className="section-heading">Notable Feature</h3>
      <p>{location.notableFeature}</p>
      <h3 className="section-heading">Who's Here</h3>
      <p>{location.keeper}</p>
      <h3 className="section-heading">Rumor</h3>
      <p>{location.rumor}</p>
    </div>
  );
}
