import { useEffect, useState } from "react";
import type { BaseState, Faction } from "@spark/shared";
import { BASE_UPGRADES } from "@spark/shared";
import { api } from "../api";
import { CATEGORIES, CATEGORY_LABELS, describeEffect } from "../baseEffects";

interface FactionSelection {
  factionId: string;
  rivalFactionId: string;
}

const EMPTY_SELECTION: FactionSelection = { factionId: "", rivalFactionId: "" };

export function BasePanel({ worldId, onNavigateToBilling, onFactionsChanged }: { worldId: string; onNavigateToBilling: () => void; onFactionsChanged?: () => void }) {
  const [data, setData] = useState<BaseState | null>(null);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, FactionSelection>>({});

  function refresh() {
    setLoading(true);
    setError(null);
    Promise.all([api.getBase(worldId), api.listFactions(worldId)])
      .then(([base, factionList]) => { setData(base); setFactions(factionList); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [worldId]);

  function setSelection(upgradeId: string, patch: Partial<FactionSelection>) {
    setSelections((prev) => ({ ...prev, [upgradeId]: { ...EMPTY_SELECTION, ...prev[upgradeId], ...patch } }));
  }

  function purchase(upgradeId: string) {
    const def = BASE_UPGRADES.find((u) => u.id === upgradeId);
    const selection = selections[upgradeId] ?? EMPTY_SELECTION;
    setPurchasingId(upgradeId);
    setError(null);
    api.purchaseBaseUpgrade(worldId, upgradeId, selection.factionId || undefined, selection.rivalFactionId || undefined)
      .then((next) => {
        setData(next);
        if (def?.effect?.kind === "reputationDelta" && (selection.factionId || selection.rivalFactionId)) {
          onFactionsChanged?.();
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setPurchasingId(null));
  }

  if (loading) return <div className="panel"><p className="hint">Loading…</p></div>;
  if (!data) return <div className="panel"><p className="error">{error ?? "Couldn't load the base."}</p></div>;

  const acquired = new Set(data.acquiredUpgradeIds);

  return (
    <div className="panel">
      <h3 className="section-heading">{data.name} — Level {data.level}</h3>
      <p className="hint">Invest the party's gold to expand the base. {data.gold} gp available. Defense Rating {data.defenseRating}.</p>
      {error && <p className="error">{error}</p>}

      {!data.isPaid && (
        <div className="upgrade-callout">
          <p>The home base is a paid feature — upgrade to start investing in it.</p>
          <button className="btn-primary" onClick={onNavigateToBilling}>Upgrade — $4.99/mo</button>
        </div>
      )}

      {CATEGORIES.map((category) => {
        const defs = BASE_UPGRADES.filter((u) => u.category === category);
        return (
          <div key={category} className="base-category">
            <h4 className="base-category-heading">{CATEGORY_LABELS[category]}</h4>
            <ul className="entity-list">
              {defs.map((def) => {
                const owned = acquired.has(def.id);
                const missingPrereqs = (def.prerequisiteIds ?? []).filter((id) => !acquired.has(id));
                const exclusiveBlocked = !owned && def.exclusiveGroup
                  ? data.acquiredUpgradeIds.some((id) => BASE_UPGRADES.find((u) => u.id === id)?.exclusiveGroup === def.exclusiveGroup)
                  : false;
                const canAfford = data.gold >= def.cost;
                const purchasable = data.isPaid && !owned && missingPrereqs.length === 0 && !exclusiveBlocked && canAfford;
                const effectText = describeEffect(def);
                const unlockedShop = data.unlockedShops.find((s) => s.upgradeId === def.id);

                return (
                  <li key={def.id} className={`tavern-row base-upgrade-row ${owned ? "base-upgrade-owned" : ""}`}>
                    <span className="entity-name">{def.name}{owned && <span className="base-upgrade-owned-tag"> — Acquired</span>}</span>
                    <span className="entity-meta">{def.cost} gp</span>
                    <p className="tavern-row-detail">{def.description}</p>
                    {effectText && <p className="tavern-row-detail base-upgrade-effect">{effectText}</p>}
                    {owned && unlockedShop && (
                      <p className="tavern-row-detail base-upgrade-effect">A new shop, "{unlockedShop.shopName}", has appeared on the Shop tab.</p>
                    )}
                    {!owned && missingPrereqs.length > 0 && (
                      <p className="tavern-row-detail base-upgrade-blocked">Requires: {missingPrereqs.map((id) => BASE_UPGRADES.find((u) => u.id === id)?.name ?? id).join(", ")}</p>
                    )}
                    {!owned && exclusiveBlocked && (
                      <p className="tavern-row-detail base-upgrade-blocked">Already committed to a different path here.</p>
                    )}
                    {!owned && missingPrereqs.length === 0 && !exclusiveBlocked && !canAfford && data.isPaid && (
                      <p className="tavern-row-detail base-upgrade-blocked">Not enough gold.</p>
                    )}
                    {!owned && purchasable && def.effect?.kind === "reputationDelta" && factions.length > 0 && (
                      <div className="base-faction-pickers">
                        <label className="field">
                          <span>Apply {def.effect.value >= 0 ? "+" : ""}{def.effect.value} to (optional)</span>
                          <select
                            value={selections[def.id]?.factionId ?? ""}
                            onChange={(e) => setSelection(def.id, { factionId: e.target.value })}
                          >
                            <option value="">— none —</option>
                            {factions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                        </label>
                        {def.effect.rivalValue !== undefined && (
                          <label className="field">
                            <span>Apply {def.effect.rivalValue} to (optional)</span>
                            <select
                              value={selections[def.id]?.rivalFactionId ?? ""}
                              onChange={(e) => setSelection(def.id, { rivalFactionId: e.target.value })}
                            >
                              <option value="">— none —</option>
                              {factions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                          </label>
                        )}
                      </div>
                    )}
                    {!owned && (
                      <button
                        className="btn-secondary"
                        disabled={!purchasable || purchasingId === def.id}
                        onClick={() => purchase(def.id)}
                      >
                        {purchasingId === def.id ? "Investing…" : "Invest"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
