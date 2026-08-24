import type { GeneratedItem } from "@spark/shared";
import { ITEM_BONUS_TYPE_LABELS } from "@spark/shared";

export function ItemCardView({ item }: { item: GeneratedItem }) {
  return (
    <div className="statblock item-card">
      <h2 className="statblock-name">{item.name}</h2>
      <p className="statblock-subtitle">{item.category} &middot; {item.rarity} &middot; {item.value} gp</p>
      <div className="item-stat-badges">
        {item.bonusType !== "none" && item.bonusValue > 0 && (
          <span className="item-stat-badge">+{item.bonusValue} {ITEM_BONUS_TYPE_LABELS[item.bonusType]}</span>
        )}
        {item.requiresAttunement && <span className="item-stat-badge attunement">Requires Attunement</span>}
        {item.charges != null && (
          <span className="item-stat-badge">
            {item.charges} charge{item.charges === 1 ? "" : "s"}{item.rechargeRule ? ` · ${item.rechargeRule}` : ""}
          </span>
        )}
      </div>
      <hr className="rule gold" />
      <p>{item.description}</p>
      <h3 className="section-heading">Property</h3>
      <p>{item.property}</p>
      <h3 className="section-heading">History</h3>
      <p>{item.history}</p>
    </div>
  );
}
