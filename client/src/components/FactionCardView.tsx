import { useState } from "react";
import type { GeneratedFaction } from "@spark/shared";
import { computeReputationTier, REPUTATION_TIER_LABELS } from "@spark/shared";

export function FactionCardView({
  faction, canEdit, onAdjustReputation,
}: {
  faction: GeneratedFaction & { reputation?: number };
  canEdit?: boolean;
  onAdjustReputation?: (delta: number) => void;
}) {
  const [delta, setDelta] = useState("");

  return (
    <div className="statblock item-card">
      <h2 className="statblock-name">{faction.name}</h2>
      <p className="statblock-subtitle">{faction.factionType}</p>
      <hr className="rule gold" />
      <h3 className="section-heading">Agenda</h3>
      <p>{faction.agenda}</p>
      <h3 className="section-heading">Methods</h3>
      <p>{faction.methods}</p>
      <h3 className="section-heading">Public Face</h3>
      <p>{faction.publicFace}</p>
      <h3 className="section-heading">Hook</h3>
      <p>{faction.hook}</p>

      {faction.reputation !== undefined && (
        <>
          <h3 className="section-heading">Reputation</h3>
          <p className={`reputation-readout reputation-${computeReputationTier(faction.reputation)}`}>
            {REPUTATION_TIER_LABELS[computeReputationTier(faction.reputation)]} ({faction.reputation})
          </p>
          {canEdit && onAdjustReputation && (
            <div className="button-row">
              <input
                type="number"
                className="reputation-delta-input"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                placeholder="amount"
                aria-label="Reputation change amount"
              />
              <button
                className="btn-secondary"
                onClick={() => {
                  const amount = Number(delta);
                  if (!delta || Number.isNaN(amount) || amount === 0) return;
                  onAdjustReputation(amount);
                  setDelta("");
                }}
              >
                Adjust
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
