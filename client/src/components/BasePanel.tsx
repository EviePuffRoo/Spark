import { useEffect, useState } from "react";
import type { BaseState, BaseUpgradeCategory } from "@spark/shared";
import { BASE_UPGRADES } from "@spark/shared";
import { api } from "../api";

const CATEGORY_LABELS: Record<BaseUpgradeCategory, string> = {
  defenses: "Defenses",
  trade: "Trade",
  influence: "Influence",
  comfort: "Comfort",
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as BaseUpgradeCategory[];

export function BasePanel({ worldId, onNavigateToBilling }: { worldId: string; onNavigateToBilling: () => void }) {
  const [data, setData] = useState<BaseState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setError(null);
    api.getBase(worldId)
      .then(setData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [worldId]);

  function purchase(upgradeId: string) {
    setPurchasingId(upgradeId);
    setError(null);
    api.purchaseBaseUpgrade(worldId, upgradeId)
      .then(setData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setPurchasingId(null));
  }

  if (loading) return <div className="panel"><p className="hint">Loading…</p></div>;
  if (!data) return <div className="panel"><p className="error">{error ?? "Couldn't load the base."}</p></div>;

  const acquired = new Set(data.acquiredUpgradeIds);

  return (
    <div className="panel">
      <h3 className="section-heading">{data.name} — Level {data.level}</h3>
      <p className="hint">Invest the party's gold to expand the base. {data.gold} gp available.</p>
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

                return (
                  <li key={def.id} className={`tavern-row base-upgrade-row ${owned ? "base-upgrade-owned" : ""}`}>
                    <span className="entity-name">{def.name}{owned && <span className="base-upgrade-owned-tag"> — Acquired</span>}</span>
                    <span className="entity-meta">{def.cost} gp</span>
                    <p className="tavern-row-detail">{def.description}</p>
                    {!owned && missingPrereqs.length > 0 && (
                      <p className="tavern-row-detail base-upgrade-blocked">Requires: {missingPrereqs.map((id) => BASE_UPGRADES.find((u) => u.id === id)?.name ?? id).join(", ")}</p>
                    )}
                    {!owned && exclusiveBlocked && (
                      <p className="tavern-row-detail base-upgrade-blocked">Already committed to a different path here.</p>
                    )}
                    {!owned && missingPrereqs.length === 0 && !exclusiveBlocked && !canAfford && data.isPaid && (
                      <p className="tavern-row-detail base-upgrade-blocked">Not enough gold.</p>
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
