import { useEffect, useState } from "react";
import type { Character, Faction, QuestHook } from "@spark/shared";
import { computeReputationTier, REPUTATION_TIER_LABELS } from "@spark/shared";
import { api } from "../api";
import { useActiveWorld } from "../ActiveWorldContext";
import { TavernIcon } from "../components/icons";
import { EmptyState } from "../components/EmptyState";
import { BasePanel } from "../components/BasePanel";

export function TavernPage({ onNavigateToBilling }: { onNavigateToBilling: () => void }) {
  const { worlds, worldId, setWorldId } = useActiveWorld();
  const [rumors, setRumors] = useState<QuestHook[]>([]);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [npcs, setNpcs] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);
  // Bumped after a Base purchase applies a reputation delta — Faction
  // Standings below is a sibling of BasePanel with its own fetch, so it
  // otherwise wouldn't know a faction's standing just changed.
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!worldId) {
      setRumors([]);
      setFactions([]);
      setNpcs([]);
      return;
    }
    setLoading(true);
    Promise.all([api.listQuests(worldId), api.listFactions(worldId), api.listCharacters(worldId)])
      .then(([quests, factionList, characters]) => {
        setRumors(quests.filter((q) => !q.hiddenFromParty && q.status === "active"));
        // Most notable standings first — a faction that hates or loves the
        // party is more worth catching up on than one sitting at neutral.
        setFactions(
          factionList.filter((f) => !f.hiddenFromParty).sort((a, b) => Math.abs(b.reputation) - Math.abs(a.reputation)),
        );
        setNpcs(characters.filter((c) => !c.hiddenFromParty && c.kind === "npc"));
      })
      .finally(() => setLoading(false));
  }, [worldId, refreshTick]);

  return (
    <div className="page">
      <div className="panel">
        <div className="page-title">
          <TavernIcon className="page-title-icon" aria-hidden="true" />
          <h2>The Tavern</h2>
        </div>
        <p className="hint">Catch up between sessions — rumors on the board, who stands where, and familiar faces.</p>

        {worlds.length === 0 ? (
          <p className="hint">Create or join a world to visit its tavern.</p>
        ) : (
          <label className="field">
            <span>World</span>
            <select value={worldId} onChange={(e) => setWorldId(e.target.value)}>
              <option value="">Select a world…</option>
              {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
        )}
      </div>

      {!worldId && (
        <div className="panel">
          <EmptyState icon={<TavernIcon />} heading="No world selected" hint="Select a world above to step into its tavern." />
        </div>
      )}

      {worldId && (
        <>
          <div className="panel">
            <h3 className="section-heading">Rumors on the Board</h3>
            {loading && <p className="hint">Loading…</p>}
            {!loading && rumors.length === 0 && <p className="hint">No rumors circulating right now.</p>}
            <ul className="entity-list">
              {rumors.map((q) => (
                <li key={q.id} className="tavern-row">
                  <span className="entity-name">{q.title}</span>
                  <span className="entity-meta">{q.questType} · {q.tier}</span>
                  <p className="tavern-row-detail">{q.hook}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel">
            <h3 className="section-heading">Faction Standings</h3>
            {!loading && factions.length === 0 && <p className="hint">No factions known yet.</p>}
            <ul className="entity-list">
              {factions.map((f) => {
                const tier = computeReputationTier(f.reputation);
                return (
                  <li key={f.id} className="tavern-row">
                    <span className="entity-name">{f.name}</span>
                    <span className={`reputation-readout reputation-${tier}`}>
                      {REPUTATION_TIER_LABELS[tier]} ({f.reputation})
                    </span>
                    <p className="tavern-row-detail">{f.publicFace}</p>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="panel">
            <h3 className="section-heading">Faces Around Town</h3>
            {!loading && npcs.length === 0 && <p className="hint">No NPCs revealed yet.</p>}
            <ul className="entity-list">
              {npcs.map((c) => (
                <li key={c.id} className="tavern-row">
                  <span className="entity-name">{c.name}</span>
                  <span className="entity-meta">{c.race ?? c.templateName}{c.background ? ` · ${c.background}` : ""}</span>
                </li>
              ))}
            </ul>
          </div>

          <BasePanel worldId={worldId} onNavigateToBilling={onNavigateToBilling} onFactionsChanged={() => setRefreshTick((n) => n + 1)} />
        </>
      )}
    </div>
  );
}
