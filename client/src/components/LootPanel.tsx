import { useState } from "react";
import type { LiveCombatant, SearchResult } from "@spark/shared";
import { api } from "../api";
import { EntitySearchPicker } from "./EntitySearchPicker";

// Records what a downed enemy was carrying into the party's shared ledger,
// as either gold or a named item.
//
// The third of the tracker's self-contained flows to move out of
// InitiativeTracker (after attack and spellcasting) — it kept nine pieces
// of state there, next to the battle grid, so typing an amount re-rendered
// the map. Nothing here touches the encounter; it only writes a ledger
// entry, so the whole flow including its API call lives in the component.
export function LootPanel({
  from, worldId, defaultAuthorName, onRecorded,
}: {
  // The downed combatant the loot came off.
  from: LiveCombatant;
  // The party world the ledger entry goes to. Empty when the tracker is in
  // party mode but no world is selected yet — submitting is a no-op then,
  // matching what this flow did before it moved out of InitiativeTracker.
  worldId: string;
  // The signed-in user's display name, pre-filled as who found it.
  defaultAuthorName: string;
  // Closes the panel once an entry has been written.
  onRecorded: () => void;
}) {
  const [kind, setKind] = useState<"gold" | "item">("gold");
  const [label, setLabel] = useState(`Loot from ${from.name}`);
  const [itemId, setItemId] = useState<string | null>(null);
  const [pickingItem, setPickingItem] = useState(false);
  const [amount, setAmount] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  function pickItem(result: SearchResult) {
    setLabel(result.name);
    setItemId(result.id);
    setPickingItem(false);
  }

  async function submit() {
    const parsed = Math.trunc(Number(amount));
    if (!worldId || !parsed || parsed <= 0) return;
    setStatus("saving");
    setError(null);
    try {
      await api.postLedgerEntry({
        worldId,
        kind,
        amount: parsed,
        label: label.trim() || (kind === "gold" ? `Loot from ${from.name}` : from.name),
        authorName: authorName.trim() || defaultAuthorName,
        itemId: kind === "item" ? (itemId ?? undefined) : undefined,
      });
      setAmount("");
      onRecorded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="save-panel">
      <div className="tabs" role="tablist">
        <button role="tab" className={kind === "gold" ? "active" : ""} aria-selected={kind === "gold"} onClick={() => { setKind("gold"); setLabel(`Loot from ${from.name}`); setItemId(null); }}>Gold</button>
        <button role="tab" className={kind === "item" ? "active" : ""} aria-selected={kind === "item"} onClick={() => { setKind("item"); setLabel(""); setItemId(null); }}>Item</button>
      </div>
      <label className="field">
        <span>{kind === "gold" ? "Reason" : "Item name"}</span>
        <input type="text" value={label} onChange={(e) => { setLabel(e.target.value); setItemId(null); }} />
      </label>
      {kind === "item" && (
        pickingItem ? (
          <div className="save-panel">
            <EntitySearchPicker type="item" onSelect={pickItem} placeholder="Search items…" />
            <button className="btn-secondary" onClick={() => setPickingItem(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn-secondary" onClick={() => setPickingItem(true)}>Pick from Compendium…</button>
        )
      )}
      <label className="field">
        <span>{kind === "gold" ? "Gold amount" : "Quantity"}</span>
        <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label className="field">
        <span>Your name</span>
        <input type="text" value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder={defaultAuthorName} />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn-primary" onClick={submit} disabled={status === "saving"}>
        {status === "saving" ? "Adding…" : "Add to Ledger"}
      </button>
    </div>
  );
}
