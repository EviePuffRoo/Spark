import type { Settlement, Faction, Location, Character, Shop, EntityType } from "@spark/shared";
import { computeReputationTier, REPUTATION_TIER_LABELS } from "@spark/shared";

// A read-focused dashboard for a single settlement — the "Phase C" promised
// in Phase A/B: aggregates the settlement's own stats, its controlling
// faction's live reputation, and everything anchored to it (locations,
// notable NPCs, shops) in one place, instead of making the DM piece that
// picture together by flipping between Roster tabs. Purely a view: every
// entity here is still edited from its own Roster entry, reached via
// onSelectEntity — mirrors FactionWebView's full-page-swap pattern.
export function SettlementHubView({
  settlement, controllingFaction, locations, characters, shops, onSelectEntity, onClose,
}: {
  settlement: Settlement;
  controllingFaction: Faction | null;
  locations: Location[];
  characters: Character[];
  shops: Shop[];
  onSelectEntity: (type: EntityType, id: string) => void;
  onClose: () => void;
}) {
  const notableNpcs = characters.filter((c) => c.kind === "npc");

  return (
    <div className="settlement-hub">
      <div className="faction-web-header">
        <h2>{settlement.name}</h2>
        <button className="btn-secondary" onClick={onClose}>Back to Roster</button>
      </div>
      <p className="hint">
        {settlement.settlementType}
        {settlement.population ? ` · Population ${settlement.population}` : ""}
        {settlement.government ? ` · ${settlement.government}` : ""}
      </p>
      <p>{settlement.description}</p>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Prosperity</span>
          <span className="stat-value">{settlement.prosperity || "Unknown"}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Danger Level</span>
          <span className="stat-value">{settlement.dangerLevel || "Unknown"}</span>
        </div>
      </div>

      <h3 className="section-heading">Controlling Faction</h3>
      {controllingFaction ? (
        <div className="stat-card">
          <button className="link-button" onClick={() => onSelectEntity("faction", controllingFaction.id)}>
            {controllingFaction.name}
          </button>
          <p className={`reputation-readout reputation-${computeReputationTier(controllingFaction.reputation)}`}>
            {REPUTATION_TIER_LABELS[computeReputationTier(controllingFaction.reputation)]} ({controllingFaction.reputation})
          </p>
        </div>
      ) : (
        <p className="hint">No controlling faction assigned.</p>
      )}

      <h3 className="section-heading">Locations ({locations.length})</h3>
      {locations.length === 0 ? (
        <p className="hint">No locations anchored here yet.</p>
      ) : (
        <ul className="entity-list">
          {locations.map((l) => (
            <li key={l.id}>
              <button className="entity-item" onClick={() => onSelectEntity("location", l.id)}>
                <span className="entity-name">{l.name}</span>
                <span className="entity-meta">{l.category} · {l.locationType}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="section-heading">Notable NPCs ({notableNpcs.length})</h3>
      {notableNpcs.length === 0 ? (
        <p className="hint">No NPCs anchored here yet.</p>
      ) : (
        <ul className="entity-list">
          {notableNpcs.map((c) => (
            <li key={c.id}>
              <button className="entity-item" onClick={() => onSelectEntity("character", c.id)}>
                <span className="entity-name">{c.name}</span>
                <span className="entity-meta">{c.race} · {REPUTATION_TIER_LABELS[computeReputationTier(c.disposition)]} ({c.disposition})</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="section-heading">Shops ({shops.length})</h3>
      {shops.length === 0 ? (
        <p className="hint">No shops anchored here yet.</p>
      ) : (
        <ul className="entity-list">
          {shops.map((s) => (
            <li key={s.id}>
              <button className="entity-item" onClick={() => onSelectEntity("shop", s.id)}>
                <span className="entity-name">{s.name}</span>
                <span className="entity-meta">{s.stock.length} item{s.stock.length === 1 ? "" : "s"} in stock</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
