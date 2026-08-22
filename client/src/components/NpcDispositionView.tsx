import { useEffect, useState } from "react";
import type { Faction, SearchResult } from "@spark/shared";
import { computeReputationTier, REPUTATION_TIER_LABELS } from "@spark/shared";
import { api } from "../api";
import { EntitySearchPicker } from "./EntitySearchPicker";

export function NpcDispositionView({
  disposition, factionId, canEdit, onAdjust, onLinkFaction, onSyncToFaction,
}: {
  disposition: number;
  factionId?: string | null;
  canEdit?: boolean;
  onAdjust?: (delta: number) => void;
  onLinkFaction?: (factionId: string | null) => void;
  onSyncToFaction?: (reputation: number) => void;
}) {
  const [delta, setDelta] = useState("");
  const [faction, setFaction] = useState<Faction | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!factionId) {
      setFaction(null);
      return;
    }
    let cancelled = false;
    api.getFaction(factionId).then((f) => { if (!cancelled) setFaction(f); }).catch(() => { if (!cancelled) setFaction(null); });
    return () => { cancelled = true; };
  }, [factionId]);

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

      {(faction || (canEdit && onLinkFaction)) && <h3 className="section-heading">Faction</h3>}
      {faction && (
        <div className="button-row">
          <span>
            {faction.name} — {REPUTATION_TIER_LABELS[computeReputationTier(faction.reputation)]} ({faction.reputation})
          </span>
          {canEdit && onSyncToFaction && (
            <button className="btn-secondary" onClick={() => onSyncToFaction(faction.reputation)}>
              Sync Disposition to Faction
            </button>
          )}
          {canEdit && onLinkFaction && (
            <button className="btn-secondary" onClick={() => onLinkFaction(null)}>Unlink</button>
          )}
        </div>
      )}
      {canEdit && onLinkFaction && !faction && (
        picking ? (
          <div className="save-panel">
            <EntitySearchPicker
              type="faction"
              onSelect={(result: SearchResult) => { onLinkFaction(result.id); setPicking(false); }}
              placeholder="Search factions…"
            />
            <button className="btn-secondary" onClick={() => setPicking(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn-secondary" onClick={() => setPicking(true)}>+ Link Faction</button>
        )
      )}
    </>
  );
}
