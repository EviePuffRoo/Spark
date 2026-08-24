import { useEffect, useState } from "react";
import type { Faction, SearchResult, DispositionLogEntry } from "@spark/shared";
import { computeReputationTier, REPUTATION_TIER_LABELS } from "@spark/shared";
import { api } from "../api";
import { EntitySearchPicker } from "./EntitySearchPicker";
import { timeAgo } from "./DiceRoller";

export function NpcDispositionView({
  characterId, disposition, factionId, canEdit, onChanged, onLinkFaction,
}: {
  characterId: string;
  disposition: number;
  factionId?: string | null;
  canEdit?: boolean;
  onChanged?: () => void;
  onLinkFaction?: (factionId: string | null) => void;
}) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [faction, setFaction] = useState<Faction | null>(null);
  const [picking, setPicking] = useState(false);
  const [log, setLog] = useState<DispositionLogEntry[]>([]);

  useEffect(() => {
    if (!factionId) {
      setFaction(null);
      return;
    }
    let cancelled = false;
    api.getFaction(factionId).then((f) => { if (!cancelled) setFaction(f); }).catch(() => { if (!cancelled) setFaction(null); });
    return () => { cancelled = true; };
  }, [factionId]);

  useEffect(() => {
    let cancelled = false;
    api.getDispositionLog(characterId).then((entries) => { if (!cancelled) setLog(entries); }).catch(() => { if (!cancelled) setLog([]); });
    return () => { cancelled = true; };
  }, [characterId, disposition]);

  async function adjust(amount: number, adjustReason?: string) {
    await api.adjustCharacterDisposition(characterId, amount, adjustReason);
    onChanged?.();
  }

  return (
    <>
      <h3 className="section-heading">Disposition</h3>
      <p className={`reputation-readout reputation-${computeReputationTier(disposition)}`}>
        {REPUTATION_TIER_LABELS[computeReputationTier(disposition)]} ({disposition})
      </p>
      {canEdit && (
        <div className="button-row">
          <input
            type="number"
            className="reputation-delta-input"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="amount"
            aria-label="Disposition change amount"
          />
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            aria-label="Disposition change reason"
          />
          <button
            className="btn-secondary"
            onClick={async () => {
              const amount = Number(delta);
              if (!delta || Number.isNaN(amount) || amount === 0) return;
              await adjust(amount, reason || undefined);
              setDelta("");
              setReason("");
            }}
          >
            Adjust
          </button>
        </div>
      )}

      {log.length > 0 && (
        <ul className="dice-history">
          {log.map((entry) => (
            <li key={entry.id} className="dice-history-row">
              <div className="dice-history-main">
                <span>
                  {entry.delta > 0 ? "+" : ""}{entry.delta} by {entry.authorName}
                  {entry.reason ? ` · ${entry.reason}` : ""}
                </span>
                <span className="dice-history-time">{timeAgo(new Date(entry.createdAt).getTime())}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(faction || (canEdit && onLinkFaction)) && <h3 className="section-heading">Faction</h3>}
      {faction && (
        <div className="button-row">
          <span>
            {faction.name}: {REPUTATION_TIER_LABELS[computeReputationTier(faction.reputation)]} ({faction.reputation})
          </span>
          {canEdit && faction.reputation !== disposition && (
            <button className="btn-secondary" onClick={() => adjust(faction.reputation - disposition, `Synced to ${faction.name}'s reputation`)}>
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
