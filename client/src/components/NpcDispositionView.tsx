import { useState } from "react";
import { computeReputationTier, REPUTATION_TIER_LABELS } from "@spark/shared";

export function NpcDispositionView({
  disposition, canEdit, onAdjust,
}: {
  disposition: number;
  canEdit?: boolean;
  onAdjust?: (delta: number) => void;
}) {
  const [delta, setDelta] = useState("");

  return (
    <>
      <h3 className="section-heading">Disposition</h3>
      <p className={`reputation-readout reputation-${computeReputationTier(disposition)}`}>
        {REPUTATION_TIER_LABELS[computeReputationTier(disposition)]} ({disposition})
      </p>
      {canEdit && onAdjust && (
        <div className="button-row">
          <input
            type="number"
            className="reputation-delta-input"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="amount"
            aria-label="Disposition change amount"
          />
          <button
            className="btn-secondary"
            onClick={() => {
              const amount = Number(delta);
              if (!delta || Number.isNaN(amount) || amount === 0) return;
              onAdjust(amount);
              setDelta("");
            }}
          >
            Adjust
          </button>
        </div>
      )}
    </>
  );
}
