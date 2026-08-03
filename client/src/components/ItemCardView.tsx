import type { GeneratedItem } from "@spark/shared";

export function ItemCardView({ item }: { item: GeneratedItem }) {
  return (
    <div className="statblock item-card">
      <h2 className="statblock-name">{item.name}</h2>
      <p className="statblock-subtitle">{item.category} &middot; {item.rarity}</p>
      <hr className="rule gold" />
      <p>{item.description}</p>
      <h3 className="section-heading">Property</h3>
      <p>{item.property}</p>
      <h3 className="section-heading">History</h3>
      <p>{item.history}</p>
    </div>
  );
}
