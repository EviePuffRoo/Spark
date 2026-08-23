import type { GeneratedSettlement } from "@spark/shared";

export function SettlementCardView({ settlement }: { settlement: GeneratedSettlement }) {
  return (
    <div className="statblock item-card">
      <h2 className="statblock-name">{settlement.name}</h2>
      <p className="statblock-subtitle">
        {settlement.settlementType}
        {settlement.population ? ` · Population ${settlement.population}` : ""}
      </p>
      <hr className="rule gold" />
      <p>{settlement.description}</p>
      {(settlement.prosperity || settlement.dangerLevel) && (
        <p className="entity-meta">
          {settlement.prosperity ? `${settlement.prosperity} prosperity` : ""}
          {settlement.prosperity && settlement.dangerLevel ? " · " : ""}
          {settlement.dangerLevel ? `${settlement.dangerLevel} danger` : ""}
        </p>
      )}
      {settlement.government && (
        <>
          <h3 className="section-heading">Government</h3>
          <p>{settlement.government}</p>
        </>
      )}
    </div>
  );
}
