import type { Shop } from "@spark/shared";

export function ShopCardView({ shop }: { shop: Shop }) {
  return (
    <div className="statblock item-card">
      <h2 className="statblock-name">{shop.name}</h2>
      {shop.description && <p className="statblock-subtitle">{shop.description}</p>}
      <hr className="rule gold" />

      <h3 className="section-heading">Stock</h3>
      {shop.stock.length === 0 && <p className="hint">Nothing stocked yet.</p>}
      <ul className="entity-list">
        {shop.stock.map((entry) => (
          <li key={entry.id} className="world-row">
            <span className="entity-name">{entry.itemName}</span>
            <span className="entity-meta">
              {entry.price} gp · {entry.quantity === -1 ? "unlimited" : `${entry.quantity} in stock`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
