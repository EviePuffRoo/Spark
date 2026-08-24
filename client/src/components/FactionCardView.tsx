import { useEffect, useState } from "react";
import type { GeneratedFaction, FactionLogEntry, FactionRelationship, FactionRelationshipStance, SearchResult, FactionBattleProposal } from "@spark/shared";
import { computeReputationTier, REPUTATION_TIER_LABELS, FACTION_RELATIONSHIP_STANCES, FACTION_RELATIONSHIP_STANCE_LABELS } from "@spark/shared";
import { api } from "../api";
import { EntitySearchPicker } from "./EntitySearchPicker";
import { timeAgo } from "./DiceRoller";

export function FactionCardView({
  faction, canEdit, onChanged,
}: {
  faction: GeneratedFaction & { id?: string; reputation?: number; worldId?: string | null };
  canEdit?: boolean;
  onChanged?: () => void;
}) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [log, setLog] = useState<FactionLogEntry[]>([]);
  const [relationships, setRelationships] = useState<FactionRelationship[]>([]);
  const [otherFactionNames, setOtherFactionNames] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState(false);
  const [pendingStance, setPendingStance] = useState<FactionRelationshipStance>("ally");
  const [battleRelationshipId, setBattleRelationshipId] = useState<string | null>(null);
  const [battleProposal, setBattleProposal] = useState<FactionBattleProposal | null>(null);
  const [battleLoading, setBattleLoading] = useState(false);
  const [battleApplying, setBattleApplying] = useState(false);
  const [battleError, setBattleError] = useState<string | null>(null);
  const [battleResult, setBattleResult] = useState<string | null>(null);

  const factionId = faction.id;
  const worldId = faction.worldId;

  useEffect(() => {
    if (!factionId) { setLog([]); return; }
    let cancelled = false;
    api.getFactionReputationLog(factionId).then((entries) => { if (!cancelled) setLog(entries); }).catch(() => { if (!cancelled) setLog([]); });
    return () => { cancelled = true; };
  }, [factionId, faction.reputation]);

  async function refreshRelationships() {
    if (!factionId || !worldId) { setRelationships([]); return; }
    const rows = await api.listFactionRelationships(worldId);
    setRelationships(rows.filter((r) => r.factionAId === factionId || r.factionBId === factionId));
  }

  useEffect(() => {
    refreshRelationships();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factionId, worldId]);

  useEffect(() => {
    const otherIds = relationships.map((r) => (r.factionAId === factionId ? r.factionBId : r.factionAId));
    const missing = [...new Set(otherIds)].filter((id) => !(id in otherFactionNames));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((id) => api.getFaction(id).then((f) => [id, f.name] as const).catch(() => [id, "Unknown faction"] as const)))
      .then((pairs) => { if (!cancelled) setOtherFactionNames((prev) => ({ ...prev, ...Object.fromEntries(pairs) })); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationships, factionId]);

  async function adjust() {
    if (!factionId) return;
    const amount = Number(delta);
    if (!delta || Number.isNaN(amount) || amount === 0) return;
    await api.adjustFactionReputation(factionId, amount, reason || undefined);
    setDelta("");
    setReason("");
    onChanged?.();
  }

  async function pickRelationshipTarget(result: SearchResult) {
    if (!factionId || !worldId) return;
    setPicking(false);
    await api.saveFactionRelationship({ worldId, factionAId: factionId, factionBId: result.id, stance: pendingStance });
    refreshRelationships();
  }

  async function deleteRelationship(id: string) {
    await api.deleteFactionRelationship(id);
    refreshRelationships();
  }

  async function simulateBattle(relationshipId: string) {
    setBattleRelationshipId(relationshipId);
    setBattleProposal(null);
    setBattleError(null);
    setBattleResult(null);
    setBattleLoading(true);
    try {
      const proposal = await api.simulateFactionBattle(relationshipId);
      setBattleProposal(proposal);
    } catch (e) {
      setBattleError((e as Error).message);
    } finally {
      setBattleLoading(false);
    }
  }

  function discardBattle() {
    setBattleRelationshipId(null);
    setBattleProposal(null);
    setBattleError(null);
  }

  async function applyBattle() {
    if (!battleRelationshipId) return;
    setBattleApplying(true);
    setBattleError(null);
    try {
      const { proposal } = await api.applyFactionBattle(battleRelationshipId);
      setBattleResult(proposal.title);
      setBattleRelationshipId(null);
      setBattleProposal(null);
      onChanged?.();
    } catch (e) {
      setBattleError((e as Error).message);
    } finally {
      setBattleApplying(false);
    }
  }

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
          {canEdit && factionId && (
            <div className="button-row">
              <input
                type="number"
                className="reputation-delta-input"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                placeholder="amount"
                aria-label="Reputation change amount"
              />
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional)"
                aria-label="Reputation change reason"
              />
              <button className="btn-secondary" onClick={adjust}>Adjust</button>
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
        </>
      )}

      {factionId && worldId && (
        <>
          <h3 className="section-heading">Relationships</h3>
          {battleResult && <p className="success">Battle resolved: {battleResult}</p>}
          {relationships.length === 0 && <p className="hint">No known relationships with other factions yet.</p>}
          {relationships.length > 0 && (
            <ul className="entity-list">
              {relationships.map((r) => {
                const otherId = r.factionAId === factionId ? r.factionBId : r.factionAId;
                return (
                  <li key={r.id} className="world-row">
                    <div>
                      <span className="entity-name">{otherFactionNames[otherId] ?? "…"}</span>
                      <div className="entity-meta">{FACTION_RELATIONSHIP_STANCE_LABELS[r.stance]}</div>
                    </div>
                    <div className="button-row">
                      {canEdit && r.stance === "war" && (
                        <button className="btn-secondary" onClick={() => simulateBattle(r.id)}>⚔ Resolve Battle</button>
                      )}
                      {canEdit && (
                        <button className="btn-danger" onClick={() => deleteRelationship(r.id)} aria-label={`Remove relationship with ${otherFactionNames[otherId] ?? "faction"}`}>
                          Remove
                        </button>
                      )}
                    </div>
                    {battleRelationshipId === r.id && (
                      <div className="save-panel battle-review-panel">
                        {battleLoading && <p className="hint">Simulating battle…</p>}
                        {battleError && <p className="error">{battleError}</p>}
                        {battleProposal && (
                          <>
                            <h4 className="section-heading">{battleProposal.title}</h4>
                            <p>{battleProposal.narrative}</p>
                            {battleProposal.winnerFactionId === null ? (
                              <p className="hint">Neither side has any forces to commit — nothing to apply.</p>
                            ) : (
                              <>
                                <ul className="entity-list">
                                  {battleProposal.reputationDeltas.map((d) => (
                                    <li key={d.factionId} className="entity-meta">
                                      {d.factionId === factionId ? faction.name : (otherFactionNames[d.factionId] ?? "The other faction")}: reputation {d.delta > 0 ? "+" : ""}{d.delta}
                                    </li>
                                  ))}
                                </ul>
                                {battleProposal.casualties.length > 0 && (
                                  <>
                                    <p className="entity-meta">Casualties:</p>
                                    <ul className="entity-list">
                                      {battleProposal.casualties.map((c) => (
                                        <li key={c.characterId} className="entity-meta">{c.characterName} — {c.outcome}</li>
                                      ))}
                                    </ul>
                                  </>
                                )}
                              </>
                            )}
                            <div className="button-row">
                              {battleProposal.winnerFactionId !== null && (
                                <button className="btn-primary" onClick={applyBattle} disabled={battleApplying}>
                                  {battleApplying ? "Applying…" : "Apply"}
                                </button>
                              )}
                              <button className="btn-secondary" onClick={discardBattle} disabled={battleApplying}>Discard</button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {canEdit && (
            picking ? (
              <div className="save-panel">
                <label className="field">
                  <span>Stance</span>
                  <select value={pendingStance} onChange={(e) => setPendingStance(e.target.value as FactionRelationshipStance)}>
                    {FACTION_RELATIONSHIP_STANCES.map((s) => <option key={s} value={s}>{FACTION_RELATIONSHIP_STANCE_LABELS[s]}</option>)}
                  </select>
                </label>
                <EntitySearchPicker type="faction" onSelect={pickRelationshipTarget} placeholder="Search factions…" />
                <button className="btn-secondary" onClick={() => setPicking(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn-secondary" onClick={() => setPicking(true)}>+ Add Relationship</button>
            )
          )}
        </>
      )}
    </div>
  );
}
