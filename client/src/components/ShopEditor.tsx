import { useState } from "react";
import type { ShopInput, ShopStockEntry, SearchResult } from "@spark/shared";
import { EntitySearchPicker } from "./EntitySearchPicker";

export function ShopEditor({
  value, onSave, onCancel, saveLabel = "Save",
}: {
  value: ShopInput;
  onSave: (input: ShopInput) => void | Promise<void>;
  onCancel?: () => void;
  saveLabel?: string;
}) {
  const [name, setName] = useState(value.name);
  const [description, setDescription] = useState(value.description ?? "");
  const [stock, setStock] = useState<ShopStockEntry[]>(value.stock);
  const [addingStock, setAddingStock] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  function handleAddStock(result: SearchResult) {
    setAddingStock(false);
    setStock((s) => [...s, { id: crypto.randomUUID(), itemId: result.id, itemName: result.name, price: 1, quantity: -1 }]);
  }

  function updateStock(id: string, patch: Partial<ShopStockEntry>) {
    setStock((s) => s.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  function removeStock(id: string) {
    setStock((s) => s.filter((entry) => entry.id !== id));
  }

  async function handleSave() {
    if (!name.trim()) return;
    setStatus("saving");
    try {
      await onSave({ name: name.trim(), description: description.trim() || undefined, stock });
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="shop-editor">
      <label className="field">
        <span>Shop name</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="The Rusty Anchor" />
      </label>
      <label className="field">
        <span>Description (optional)</span>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A cramped shop full of salvaged oddities" />
      </label>

      <h3 className="section-heading">Stock</h3>
      {stock.length === 0 && <p className="hint">Add an item from the roster to start stocking this shop.</p>}
      <ul className="entity-list">
        {stock.map((entry) => (
          <li key={entry.id} className="shop-stock-row">
            <span className="entity-name">{entry.itemName}</span>
            <label className="field shop-stock-field">
              <span>Price (gp)</span>
              <input type="number" min={0} value={entry.price} onChange={(e) => updateStock(entry.id, { price: Number(e.target.value) })} />
            </label>
            <label className="field shop-stock-field">
              <span>Quantity (-1 = unlimited)</span>
              <input type="number" min={-1} value={entry.quantity} onChange={(e) => updateStock(entry.id, { quantity: Number(e.target.value) })} />
            </label>
            <button className="btn-danger" onClick={() => removeStock(entry.id)} aria-label={`Remove ${entry.itemName} from stock`}>Remove</button>
          </li>
        ))}
      </ul>

      {addingStock ? (
        <div className="save-panel">
          <EntitySearchPicker type="item" onSelect={handleAddStock} placeholder="Search items…" />
          <button className="btn-secondary" onClick={() => setAddingStock(false)}>Cancel</button>
        </div>
      ) : (
        <button className="btn-secondary" onClick={() => setAddingStock(true)}>+ Add Stock</button>
      )}

      <div className="button-row">
        <button className="btn-primary" onClick={handleSave} disabled={status === "saving" || !name.trim()}>
          {status === "saving" ? "Saving…" : saveLabel}
        </button>
        {onCancel && <button className="btn-secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}
