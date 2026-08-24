import { useEffect, useState } from "react";
import type { LedgerSummary, PlayerCharacter, SearchResult } from "@spark/shared";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useActiveWorld } from "../ActiveWorldContext";
import { useWorldLiveChannel } from "../useWorldLiveChannel";
import { InventoryIcon } from "../components/icons";
import { EntitySearchPicker } from "../components/EntitySearchPicker";

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function InventoryPage() {
  const { user } = useAuth();
  const { worlds, worldId, setWorldId } = useActiveWorld();
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [authorName, setAuthorName] = useState(user?.displayName || user?.username || "");
  const [goldAmount, setGoldAmount] = useState("");
  const [goldReason, setGoldReason] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [pickedItemId, setPickedItemId] = useState<string | null>(null);
  const [pickingItem, setPickingItem] = useState(false);

  const [myCharacters, setMyCharacters] = useState<PlayerCharacter[]>([]);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);

  useEffect(() => { if (!worldId) setSummary(null); }, [worldId]);
  useEffect(() => {
    api.listMyPlayerCharacters().then(setMyCharacters).catch(() => {});
  }, []);

  const { error: liveError } = useWorldLiveChannel(worldId || null, { onLedger: setSummary });
  useEffect(() => { setError(liveError ?? null); }, [liveError]);

  const selectedWorld = worlds.find((w) => w.id === worldId) ?? null;
  const isOwner = !!selectedWorld?.isOwner;

  async function refresh() {
    if (!worldId) return;
    try {
      setSummary(await api.getLedger(worldId));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function addGold() {
    const amount = Number(goldAmount);
    if (!worldId || !amount || !Number.isFinite(amount)) return;
    setError(null);
    try {
      await api.postLedgerEntry({
        worldId, kind: "gold", amount: Math.trunc(amount),
        label: goldReason.trim() || (amount > 0 ? "Gold added" : "Gold spent"),
        authorName: authorName.trim() || user!.displayName || user!.username,
      });
      setGoldAmount("");
      setGoldReason("");
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function addItem() {
    const quantity = Number(itemQuantity);
    if (!worldId || !itemName.trim() || !quantity || !Number.isFinite(quantity)) return;
    setError(null);
    try {
      await api.postLedgerEntry({
        worldId, kind: "item", amount: Math.trunc(quantity),
        label: itemName.trim(),
        authorName: authorName.trim() || user!.displayName || user!.username,
        itemId: pickedItemId ?? undefined,
      });
      setItemName("");
      setItemQuantity("1");
      setPickedItemId(null);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function pickItem(result: SearchResult) {
    setItemName(result.name);
    setPickedItemId(result.id);
    setPickingItem(false);
  }

  async function deleteEntry(id: string) {
    try {
      await api.deleteLedgerEntry(id);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function claimItem(itemId: string, playerCharacterId: string) {
    if (!worldId) return;
    setError(null);
    try {
      await api.claimLedgerItem(worldId, itemId, playerCharacterId);
      setClaimingKey(null);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="page generator-layout">
      <div className="panel">
        <div className="page-title">
          <InventoryIcon className="page-title-icon" aria-hidden="true" />
          <h2>Party Inventory</h2>
        </div>
        <p className="hint">Shared gold and items for the whole party. Anyone can add to it or take from it.</p>

        {worlds.length === 0 ? (
          <p className="hint">Create or join a world to track a party inventory.</p>
        ) : (
          <label className="field">
            <span>World</span>
            <select value={worldId} onChange={(e) => setWorldId(e.target.value)}>
              <option value="">Select a world…</option>
              {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
        )}

        {worldId && (
          <>
            <label className="field">
              <span>Your name</span>
              <input type="text" value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder={user?.displayName || user?.username} />
            </label>

            <div className="save-panel">
              <h3 className="section-heading">Add Gold</h3>
              <label className="field">
                <span>Amount (+/-)</span>
                <input type="number" value={goldAmount} onChange={(e) => setGoldAmount(e.target.value)} placeholder="e.g. 50 or -20" />
              </label>
              <label className="field">
                <span>Reason (optional)</span>
                <input type="text" value={goldReason} onChange={(e) => setGoldReason(e.target.value)} placeholder="Sold loot, tavern bill…" />
              </label>
              <button className="btn-primary" onClick={addGold}>Add Gold</button>
            </div>

            <div className="save-panel">
              <h3 className="section-heading">Add Item</h3>
              <label className="field">
                <span>Item name</span>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => { setItemName(e.target.value); setPickedItemId(null); }}
                  placeholder="Potion of Healing"
                />
              </label>
              {pickedItemId && <p className="hint">Linked to a Compendium item, claimable onto a character later.</p>}
              {pickingItem ? (
                <div className="save-panel">
                  <EntitySearchPicker type="item" onSelect={pickItem} placeholder="Search your items…" />
                  <button className="btn-secondary" onClick={() => setPickingItem(false)}>Cancel</button>
                </div>
              ) : (
                <button className="btn-secondary" onClick={() => setPickingItem(true)}>Pick from Compendium…</button>
              )}
              <label className="field">
                <span>Quantity (+/-)</span>
                <input type="number" value={itemQuantity} onChange={(e) => setItemQuantity(e.target.value)} />
              </label>
              <button className="btn-primary" onClick={addItem}>Add Item</button>
            </div>
          </>
        )}

        {error && <p className="error">{error}</p>}
      </div>

      <div className="panel result-panel">
        {!worldId && <p className="hint">Select a world to see its party inventory.</p>}

        {worldId && summary && (
          <>
            <h3 className="section-heading">Current Holdings</h3>
            <p className="ledger-gold-total">{summary.gold} gp</p>
            {summary.items.length === 0 ? (
              <p className="hint">No items yet.</p>
            ) : (
              <ul className="entity-list">
                {summary.items.map((item) => {
                  const key = item.itemId ?? `label:${item.label}`;
                  const myCharsHere = myCharacters.filter((c) => c.worldId === worldId);
                  return (
                    <li key={key} className="world-row">
                      <span className="entity-name">{item.label}</span>
                      <span className="entity-meta">× {item.quantity}</span>
                      {item.itemId && myCharsHere.length > 0 && (
                        claimingKey === key ? (
                          <select
                            defaultValue=""
                            onChange={(e) => { if (e.target.value) claimItem(item.itemId!, e.target.value); }}
                          >
                            <option value="" disabled>Claim onto…</option>
                            {myCharsHere.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        ) : (
                          <button className="btn-secondary" onClick={() => setClaimingKey(key)}>Claim</button>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <h3 className="section-heading">History</h3>
            {summary.entries.length === 0 && <p className="hint">No activity yet. Be the first.</p>}
            <ul className="dice-history">
              {summary.entries.map((entry) => (
                <li key={entry.id} className="dice-history-row">
                  <div className="dice-history-main">
                    <span>
                      {entry.authorName}: {entry.kind === "gold"
                        ? `${entry.amount > 0 ? "+" : ""}${entry.amount} gp (${entry.label})`
                        : `${entry.amount > 0 ? "+" : ""}${entry.amount} × ${entry.label}`}
                    </span>
                    {(entry.userId === user?.id || isOwner) && (
                      <button className="dice-history-delete" onClick={() => deleteEntry(entry.id)} aria-label={`Delete entry by ${entry.authorName}`}>×</button>
                    )}
                  </div>
                  <span className="dice-history-time">{timeAgo(entry.createdAt)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
