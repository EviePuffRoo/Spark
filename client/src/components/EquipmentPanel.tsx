import { useEffect, useState } from "react";
import type { Item, SearchResult } from "@spark/shared";
import { computeEquipmentBonuses, ITEM_BONUS_TYPE_LABELS, getRuleset } from "@spark/shared";
import { api } from "../api";
import { EntitySearchPicker } from "./EntitySearchPicker";

const MAX_ATTUNED = 3;
const carryCapacityLbs = getRuleset().carryCapacityLbs;

export function EquipmentPanel({
  equippedItems, attunedItems, baseArmorClass, strengthScore, onChange,
}: {
  equippedItems: string[];
  attunedItems: string[];
  baseArmorClass?: number;
  // Only set for a player character's own equipment — an NPC/monster's
  // EquipmentPanel omits it and the carry-weight indicator below simply
  // doesn't render. Soft indicator only, never blocks adding equipment.
  strengthScore?: number;
  onChange?: (equippedItems: string[], attunedItems: string[]) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (equippedItems.length === 0) {
      setItems([]);
      return;
    }
    Promise.all(equippedItems.map((id) => api.getItem(id).catch(() => null)))
      .then((results) => setItems(results.filter((i): i is Item => !!i)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equippedItems.join(",")]);

  function addItem(result: SearchResult) {
    setAdding(false);
    if (equippedItems.includes(result.id)) return;
    onChange?.([...equippedItems, result.id], attunedItems);
  }

  function removeItem(id: string) {
    onChange?.(equippedItems.filter((i) => i !== id), attunedItems.filter((i) => i !== id));
  }

  function toggleAttune(id: string) {
    if (attunedItems.includes(id)) {
      onChange?.(equippedItems, attunedItems.filter((i) => i !== id));
    } else if (attunedItems.length < MAX_ATTUNED) {
      onChange?.(equippedItems, [...attunedItems, id]);
    }
  }

  const bonuses = computeEquipmentBonuses(items, equippedItems, attunedItems);
  const bonusEntries = (Object.keys(bonuses) as (keyof typeof bonuses)[]).filter((k) => bonuses[k] > 0);
  const hasAttunable = items.some((i) => i.requiresAttunement);

  const carriedWeight = items.reduce((sum, i) => sum + (i.weight ?? 0), 0);
  const capacity = strengthScore != null ? carryCapacityLbs(strengthScore) : null;
  const weighedCount = items.filter((i) => i.weight != null).length;

  return (
    <div className="equipment-panel">
      <h3 className="section-heading">Equipment</h3>
      {items.length === 0 && <p className="hint">Nothing equipped.</p>}
      {items.length > 0 && (
        <ul className="entity-list">
          {items.map((item) => (
            <li key={item.id} className="world-row">
              <div>
                <span className="entity-name">{item.name}</span>
                <span className="entity-meta">
                  {item.rarity}
                  {item.bonusType !== "none" && item.bonusValue > 0 ? ` · +${item.bonusValue} ${ITEM_BONUS_TYPE_LABELS[item.bonusType]}` : ""}
                  {item.requiresAttunement && !attunedItems.includes(item.id) ? " · not attuned" : ""}
                </span>
              </div>
              {item.requiresAttunement && (
                <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: "6px" }}>
                  <input
                    type="checkbox"
                    checked={attunedItems.includes(item.id)}
                    disabled={!onChange || (!attunedItems.includes(item.id) && attunedItems.length >= MAX_ATTUNED)}
                    onChange={() => toggleAttune(item.id)}
                  />
                  Attuned
                </label>
              )}
              {onChange && (
                <button className="btn-danger" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name}`}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {hasAttunable && <p className="hint">Attunement: {attunedItems.length}/{MAX_ATTUNED}</p>}

      {capacity != null && weighedCount > 0 && (
        <p className={`hint${carriedWeight > capacity ? " carry-weight-over" : ""}`}>
          Carrying {carriedWeight} / {capacity} lbs{weighedCount < items.length ? ` (${weighedCount} of ${items.length} items have a weight on file)` : ""}
        </p>
      )}

      {bonusEntries.length > 0 && (
        <div className="item-stat-badges">
          {baseArmorClass != null && bonuses.armorClass > 0 && (
            <span className="item-stat-badge">AC {baseArmorClass + bonuses.armorClass} ({baseArmorClass} base + {bonuses.armorClass} equipped)</span>
          )}
          {bonusEntries.filter((k) => k !== "armorClass" || baseArmorClass == null).map((k) => (
            <span className="item-stat-badge" key={k}>+{bonuses[k]} {ITEM_BONUS_TYPE_LABELS[k]}</span>
          ))}
        </div>
      )}

      {onChange && (
        adding ? (
          <div className="save-panel">
            <EntitySearchPicker type="item" onSelect={addItem} placeholder="Search items…" />
            <button className="btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn-secondary" onClick={() => setAdding(true)}>+ Add Equipment</button>
        )
      )}
    </div>
  );
}
