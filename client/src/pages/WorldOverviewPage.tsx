import { useEffect, useState } from "react";
import type { QuestHook, LedgerSummary, Region, Settlement } from "@spark/shared";
import { api } from "../api";
import { useActiveWorld } from "../ActiveWorldContext";
import { useAuth } from "../AuthContext";
import { WorldMapView } from "../components/WorldMapView";
import { LastSessionPanel } from "../components/LastSessionPanel";
import { SessionHighlightsPanel } from "../components/SessionHighlightsPanel";
import { NextSessionPanel } from "../components/NextSessionPanel";

export type OverviewNavTarget = "worlds" | "roster" | "codex" | "notes" | "downtime" | "shop";

export function WorldOverviewPage({ onNavigate }: { onNavigate: (subTab: OverviewNavTarget) => void }) {
  const { worlds, worldId, refreshWorlds } = useActiveWorld();
  const { user } = useAuth();
  const [quests, setQuests] = useState<QuestHook[]>([]);
  const [ledger, setLedger] = useState<LedgerSummary | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [loading, setLoading] = useState(false);

  const world = worlds.find((w) => w.id === worldId) ?? null;

  function refreshMap() {
    if (!worldId) return;
    api.listRegions(worldId).then(setRegions).catch(() => {});
    api.listSettlements(worldId).then(setSettlements).catch(() => {});
  }

  useEffect(() => {
    refreshWorlds();
    if (!worldId) {
      setQuests([]);
      setLedger(null);
      setRegions([]);
      setSettlements([]);
      return;
    }
    setLoading(true);
    Promise.all([
      api.listQuests(worldId),
      api.getLedger(worldId),
    ]).then(([q, l]) => {
      setQuests(q);
      setLedger(l);
    }).catch(() => {}).finally(() => setLoading(false));
    refreshMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId]);

  async function toggleRegionConnection(aId: string, bId: string) {
    const a = regions.find((r) => r.id === aId);
    const b = regions.find((r) => r.id === bId);
    if (!a || !b) return;
    const connected = a.connections.includes(bId);
    await Promise.all([
      api.updateRegion(aId, { connections: connected ? a.connections.filter((c) => c !== bId) : [...a.connections, bId] }),
      api.updateRegion(bId, { connections: connected ? b.connections.filter((c) => c !== aId) : [...b.connections, aId] }),
    ]);
    refreshMap();
  }

  async function updateRegionPosition(id: string, patch: Partial<Region>) {
    setRegions((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await api.updateRegion(id, patch);
  }

  if (worlds.length === 0) {
    return (
      <div className="page">
        <div className="panel">
          <h2>World Overview</h2>
          <p className="hint">You don't have any worlds yet — create one to get started.</p>
          <button className="btn-primary" onClick={() => onNavigate("worlds")}>Go to Worlds</button>
        </div>
      </div>
    );
  }

  if (!worldId || !world) {
    return (
      <div className="page">
        <div className="panel">
          <h2>World Overview</h2>
          <p className="hint">Select a world from the header to see its overview.</p>
        </div>
      </div>
    );
  }

  const activeQuests = quests.filter((q) => q.status === "active");

  const counts: [number, string][] = [
    [world.characterCount, "character"],
    [world.itemCount, "item"],
    [world.locationCount, "location"],
    [world.questCount, "quest"],
    [world.factionCount, "faction"],
    [world.encounterTableCount, "encounter table"],
    [world.sessionNoteCount, "session note"],
    [world.adventureCount, "adventure"],
    [world.playerCharacterCount, "player character"],
  ];
  const nonEmptyCounts = counts.filter(([count]) => count > 0);

  return (
    <div className="page">
      <div className="panel">
        <h2>{world.name}</h2>
        {world.description && <p className="hint">{world.description}</p>}
        <NextSessionPanel world={world} onUpdated={refreshWorlds} />
        <p className="entity-meta">
          {nonEmptyCounts.length === 0
            ? "Empty so far"
            : nonEmptyCounts.map(([count, label]) => `${count} ${label}${count === 1 ? "" : "s"}`).join(" · ")}
        </p>

        <div className="button-row">
          <button className="btn-secondary" onClick={() => onNavigate("roster")}>Roster</button>
          <button className="btn-secondary" onClick={() => onNavigate("codex")}>Codex</button>
          <button className="btn-secondary" onClick={() => onNavigate("notes")}>Notes</button>
          <button className="btn-secondary" onClick={() => onNavigate("downtime")}>Downtime</button>
          <button className="btn-secondary" onClick={() => onNavigate("shop")}>Shop</button>
          <button className="btn-secondary" aria-expanded={showMap} onClick={() => { setShowMap((v) => !v); if (!showMap) refreshMap(); }}>
            {showMap ? "Hide World Map" : "World Map"}
          </button>
        </div>
      </div>

      {showMap && (
        <div className="panel">
          <h3 className="section-heading">World Map</h3>
          {regions.length === 0 ? (
            <p className="hint">No regions yet — generate one from Create → Regions to start mapping your world.</p>
          ) : (
            <WorldMapView
              regions={regions}
              settlements={settlements}
              canEdit={!!user}
              onUpdateRegion={updateRegionPosition}
              onToggleConnection={toggleRegionConnection}
            />
          )}
        </div>
      )}

      <div className="generator-layout">
        <div className="panel">
          <h3 className="section-heading">Party</h3>
          {loading && <p className="hint">Loading…</p>}
          {!loading && <p className="ledger-gold-total mono">{ledger?.gold ?? 0} gp</p>}
          {!loading && ledger && ledger.items.length > 0 && (
            <ul className="entity-list">
              {ledger.items.map((item) => (
                <li key={item.label} className="world-row">
                  <span className="entity-name">{item.label}</span>
                  <span className="entity-meta">× {item.quantity}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <LastSessionPanel worldId={worldId} onOpenNotes={() => onNavigate("notes")} />
        <SessionHighlightsPanel worldId={worldId} />
      </div>

      <div className="panel">
        <h3 className="section-heading">Open Threads</h3>
        {loading && <p className="hint">Loading…</p>}
        {!loading && activeQuests.length === 0 && <p className="hint">No active quests for this world.</p>}
        <ul className="entity-list">
          {activeQuests.map((q) => (
            <li key={q.id} className="world-row">
              <span className="entity-name">{q.title}</span>
              <span className="entity-meta">{q.hook}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
