import { useEffect, useState } from "react";
import type { Shop, ShopCommission, Item, SearchResult } from "@spark/shared";
import { computeCraftingCost } from "@spark/shared";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useActiveWorld } from "../ActiveWorldContext";
import { ShopIcon } from "../components/icons";
import { EmptyState } from "../components/EmptyState";
import { EntitySearchPicker } from "../components/EntitySearchPicker";

const SELL_RATE = 0.5;

export function ShopPage() {
  const { user } = useAuth();
  const { worlds, worldId } = useActiveWorld();
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [authorName, setAuthorName] = useState(user?.displayName || user?.username || "");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyStockId, setBusyStockId] = useState<string | null>(null);

  const [commissions, setCommissions] = useState<ShopCommission[]>([]);
  const [commissionItem, setCommissionItem] = useState<Item | null>(null);
  const [pickingCommissionItem, setPickingCommissionItem] = useState(false);
  const [busyCommission, setBusyCommission] = useState(false);
  const [busyCommissionId, setBusyCommissionId] = useState<string | null>(null);

  const isOwner = !!worlds.find((w) => w.id === worldId)?.isOwner;

  useEffect(() => {
    if (!worldId) {
      setShops([]);
      setSelectedShopId("");
      setCommissions([]);
      return;
    }
    api.listShops(worldId).then((rows) => {
      setShops(rows);
      setSelectedShopId((current) => (rows.some((s) => s.id === current) ? current : rows[0]?.id ?? ""));
    }).catch(() => {});
    api.listShopCommissions(worldId).then(setCommissions).catch(() => {});
  }, [worldId]);

  const selectedShop = shops.find((s) => s.id === selectedShopId) ?? null;
  const shopCommissions = commissions.filter((c) => c.shopId === selectedShopId);

  function refresh() {
    if (!worldId) return;
    api.listShops(worldId).then(setShops).catch(() => {});
    api.listShopCommissions(worldId).then(setCommissions).catch(() => {});
  }

  async function pickCommissionItem(result: SearchResult) {
    setPickingCommissionItem(false);
    setCommissionItem(await api.getItem(result.id));
  }

  async function commission(shop: Shop) {
    if (!worldId || !commissionItem) return;
    setBusyCommission(true);
    setError(null);
    try {
      const name = authorName.trim() || user!.displayName || user!.username;
      await api.postShopCommission({ worldId, shopId: shop.id, itemId: commissionItem.id, characterName: name });
      setCommissionItem(null);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyCommission(false);
    }
  }

  async function deliver(commissionId: string) {
    setBusyCommissionId(commissionId);
    setError(null);
    try {
      await api.deliverShopCommission(commissionId);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyCommissionId(null);
    }
  }

  function quantityFor(stockId: string): number {
    const raw = Number(quantities[stockId]);
    return raw > 0 && Number.isFinite(raw) ? Math.trunc(raw) : 1;
  }

  async function buy(shop: Shop, stockId: string) {
    const entry = shop.stock.find((s) => s.id === stockId);
    if (!entry || !worldId) return;
    const qty = quantityFor(stockId);
    if (entry.quantity !== -1 && qty > entry.quantity) {
      setError(`Only ${entry.quantity} ${entry.itemName} in stock.`);
      return;
    }
    setBusyStockId(stockId);
    setError(null);
    try {
      const name = authorName.trim() || user!.displayName || user!.username;
      await api.postLedgerEntry({ worldId, kind: "gold", amount: -entry.price * qty, label: `Bought ${entry.itemName} from ${shop.name}`, authorName: name });
      await api.postLedgerEntry({ worldId, kind: "item", amount: qty, label: entry.itemName, authorName: name });
      if (entry.quantity !== -1) {
        const nextStock = shop.stock.map((s) => (s.id === stockId ? { ...s, quantity: s.quantity - qty } : s));
        await api.updateShop(shop.id, { stock: nextStock });
      }
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyStockId(null);
    }
  }

  async function sell(shop: Shop, stockId: string) {
    const entry = shop.stock.find((s) => s.id === stockId);
    if (!entry || !worldId) return;
    const qty = quantityFor(stockId);
    setBusyStockId(stockId);
    setError(null);
    try {
      const name = authorName.trim() || user!.displayName || user!.username;
      const sellPrice = Math.floor(entry.price * SELL_RATE);
      await api.postLedgerEntry({ worldId, kind: "gold", amount: sellPrice * qty, label: `Sold ${entry.itemName} to ${shop.name}`, authorName: name });
      await api.postLedgerEntry({ worldId, kind: "item", amount: -qty, label: entry.itemName, authorName: name });
      if (entry.quantity !== -1) {
        const nextStock = shop.stock.map((s) => (s.id === stockId ? { ...s, quantity: s.quantity + qty } : s));
        await api.updateShop(shop.id, { stock: nextStock });
      }
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyStockId(null);
    }
  }

  return (
    <div className="page generator-layout">
      <div className="panel">
        <div className="page-title">
          <ShopIcon className="page-title-icon" aria-hidden="true" />
          <h2>Shop</h2>
        </div>
        <p className="hint">Buy and sell against the party's shared ledger — selling pays half the listed price.</p>

        {worlds.length === 0 ? (
          <p className="hint">Create or join a world to shop.</p>
        ) : !worldId ? (
          <p className="hint">Select a world from the header to browse its shops.</p>
        ) : shops.length === 0 ? (
          <p className="hint">No shops in this world yet — create one from Prep &gt; Create &gt; Shops.</p>
        ) : (
          <>
            <label className="field">
              <span>Shop</span>
              <select value={selectedShopId} onChange={(e) => setSelectedShopId(e.target.value)}>
                {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Your name</span>
              <input type="text" value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder={user?.displayName || user?.username} />
            </label>
          </>
        )}

        {error && <p className="error">{error}</p>}
      </div>

      <div className="panel result-panel">
        {!selectedShop && (
          <EmptyState
            icon={<ShopIcon />}
            heading={shops.length === 0 ? "No shops yet" : "No shop selected"}
            hint={shops.length === 0 ? "Create one from Prep > Create > Shops to start stocking it." : "Select a shop from the list to browse its stock."}
          />
        )}

        {selectedShop && (
          <>
            <h3 className="section-heading">{selectedShop.name}</h3>
            {selectedShop.description && <p className="hint">{selectedShop.description}</p>}
            {selectedShop.stock.length === 0 && <p className="hint">This shop has nothing stocked.</p>}
            <ul className="entity-list shop-stock-list">
              {selectedShop.stock.map((entry) => (
                <li key={entry.id} className="shop-stock-row">
                  <div className="shop-stock-info">
                    <span className="entity-name">{entry.itemName}</span>
                    <span className="entity-meta">
                      {entry.price} gp · {entry.quantity === -1 ? "unlimited" : `${entry.quantity} in stock`}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    className="shop-quantity-input"
                    value={quantities[entry.id] ?? "1"}
                    onChange={(e) => setQuantities((q) => ({ ...q, [entry.id]: e.target.value }))}
                    aria-label={`Quantity for ${entry.itemName}`}
                  />
                  <button className="btn-primary" disabled={busyStockId === entry.id || entry.quantity === 0} onClick={() => buy(selectedShop, entry.id)}>
                    Buy
                  </button>
                  <button className="btn-secondary" disabled={busyStockId === entry.id} onClick={() => sell(selectedShop, entry.id)}>
                    Sell ({Math.floor(entry.price * SELL_RATE)} gp)
                  </button>
                </li>
              ))}
            </ul>

            <h3 className="section-heading">Commission a Custom Item</h3>
            <p className="hint">Not everything a crafter can make is sitting on the shelf — pay up front and the DM marks it delivered once the work is done.</p>
            {commissionItem ? (
              <div className="button-row">
                <span>
                  {commissionItem.name} — {computeCraftingCost(commissionItem).goldCost} gp,{" "}
                  {computeCraftingCost(commissionItem).daysRequired}d turnaround
                </span>
                <button className="btn-primary" disabled={busyCommission} onClick={() => commission(selectedShop)}>
                  {busyCommission ? "Commissioning…" : "Commission"}
                </button>
                <button className="btn-secondary" onClick={() => setCommissionItem(null)}>Clear</button>
              </div>
            ) : pickingCommissionItem ? (
              <div className="save-panel">
                <EntitySearchPicker type="item" onSelect={pickCommissionItem} placeholder="Search items…" />
                <button className="btn-secondary" onClick={() => setPickingCommissionItem(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn-secondary" onClick={() => setPickingCommissionItem(true)}>+ Pick Item to Commission</button>
            )}

            {shopCommissions.length > 0 && (
              <>
                <h3 className="section-heading">Commissions</h3>
                <ul className="entity-list">
                  {shopCommissions.map((c) => (
                    <li key={c.id} className="world-row">
                      <div>
                        <span className="entity-name">{c.itemName} for {c.characterName}</span>
                        <div className="entity-meta">
                          {c.price} gp · {c.daysRequired}d turnaround · {c.deliveredAt ? "Delivered" : "Pending"}
                        </div>
                      </div>
                      {!c.deliveredAt && isOwner && (
                        <button className="btn-primary" disabled={busyCommissionId === c.id} onClick={() => deliver(c.id)}>
                          Mark Delivered
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
