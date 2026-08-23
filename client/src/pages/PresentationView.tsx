import { useEffect, useMemo, useRef, useState } from "react";
import type { BattleMap, Dungeon, Encounter, HpStatus } from "@spark/shared";
import { computeVisionForTokens, extendWithLightSources } from "@spark/shared";
import { api } from "../api";
import { ZoneMap } from "../components/ZoneMap";
import { DungeonMapView } from "../components/DungeonMapView";
import { GridMap } from "../components/GridMap";
import { filterEncounterForDisplay } from "../encounterRedaction";
import { useWorldLiveChannel } from "../useWorldLiveChannel";

const noop = () => {};

const HP_STATUS_LABELS: Record<HpStatus, string> = {
  healthy: "Healthy",
  injured: "Injured",
  bloodied: "Bloodied",
  nearDeath: "Near Death",
  down: "Down",
};

export function PresentationView({ worldId }: { worldId: string }) {
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDungeon, setActiveDungeon] = useState<Dungeon | null>(null);
  const [activeBattleMap, setActiveBattleMap] = useState<BattleMap | null>(null);
  const [mapView, setMapView] = useState<"room" | "dungeon" | "grid">("room");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { error: liveError } = useWorldLiveChannel(worldId, { onEncounter: setEncounter });
  useEffect(() => { setError(liveError ?? null); }, [liveError]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === rootRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      rootRef.current?.requestFullscreen();
    }
  }

  useEffect(() => {
    const dungeonId = encounter?.activeDungeonId;
    if (!dungeonId) {
      setActiveDungeon(null);
      return;
    }
    let cancelled = false;
    api.getDungeon(dungeonId)
      .then((d) => { if (!cancelled) setActiveDungeon(d); })
      .catch(() => { if (!cancelled) setActiveDungeon(null); });
    return () => { cancelled = true; };
  }, [encounter?.activeDungeonId]);

  useEffect(() => {
    const mapId = encounter?.activeBattleMapId;
    if (!mapId) {
      setActiveBattleMap(null);
      return;
    }
    let cancelled = false;
    api.getBattleMap(mapId)
      .then((m) => { if (!cancelled) setActiveBattleMap(m); })
      .catch(() => { if (!cancelled) setActiveBattleMap(null); });
    return () => { cancelled = true; };
  }, [encounter?.activeBattleMapId]);

  // The DM's own fetch of the encounter never gets a server-computed
  // visibleCells (toEncounterDTO only fogs non-owner viewers) — this is a
  // shared display screen everyone at the table watches, so it needs the
  // party's actual current vision computed here, the same way
  // gridVisibility.ts does server-side for a real non-owner request.
  const visibleCells = useMemo(() => {
    if (!activeBattleMap || !encounter) return undefined;
    const mapShape = { width: activeBattleMap.width, height: activeBattleMap.height, tiles: activeBattleMap.tiles };
    return extendWithLightSources(mapShape, computeVisionForTokens(mapShape, encounter.combatants), encounter.combatants);
  }, [activeBattleMap, encounter]);

  if (error) {
    return (
      <div className="presentation-view">
        <p className="error">{error}</p>
      </div>
    );
  }
  if (!encounter) {
    return (
      <div className="presentation-view">
        <p className="hint">Waiting for the game to start…</p>
      </div>
    );
  }

  const display = filterEncounterForDisplay(encounter, visibleCells);
  const sorted = [...display.combatants].sort((a, b) => b.initiative - a.initiative);
  const activeId = sorted.length > 0 ? sorted[display.turnIndex % sorted.length]?.id ?? null : null;

  return (
    <div className="presentation-view" ref={rootRef}>
      <div className="presentation-header">
        <span className="round-banner mono">Round {display.round}</span>
        {document.fullscreenEnabled && (
          <button type="button" className="btn-secondary presentation-fullscreen-btn" onClick={toggleFullscreen}>
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        )}
      </div>

      <ol className="presentation-turn-order">
        {sorted.map((c) => (
          <li key={c.id} className={c.id === activeId ? "active-turn" : ""}>
            <span className="combatant-name">{c.name}</span>
            {c.currentHp !== undefined && c.maxHp !== undefined ? (
              <span className="combatant-hp-value">{c.currentHp} / {c.maxHp} HP</span>
            ) : (
              <span className={`hp-status-badge hp-status-${c.hpStatus}`}>{HP_STATUS_LABELS[c.hpStatus]}</span>
            )}
          </li>
        ))}
      </ol>

      {(activeDungeon || encounter.activeBattleMapId) && (
        <div className="button-row">
          <button className={mapView === "room" ? "active" : ""} aria-current={mapView === "room" ? "true" : undefined} onClick={() => setMapView("room")}>Room View</button>
          {activeDungeon && (
            <button className={mapView === "dungeon" ? "active" : ""} aria-current={mapView === "dungeon" ? "true" : undefined} onClick={() => setMapView("dungeon")}>Dungeon Map</button>
          )}
          {encounter.activeBattleMapId && (
            <button className={mapView === "grid" ? "active" : ""} aria-current={mapView === "grid" ? "true" : undefined} onClick={() => setMapView("grid")}>Battle Grid</button>
          )}
        </div>
      )}

      {mapView === "dungeon" && activeDungeon && (
        <DungeonMapView dungeon={activeDungeon} canEdit={false} onUpdateRoomRect={noop} />
      )}

      {mapView === "grid" && encounter.activeBattleMapId && (
        <GridMap
          worldId={worldId}
          battleMapId={encounter.activeBattleMapId}
          combatants={sorted}
          activeId={activeId}
          canEdit={false}
          exploredCells={encounter.exploredCells}
          visibleCells={visibleCells ? [...visibleCells] : undefined}
          onLoadBattleMap={noop}
          onLeaveBattleMap={noop}
          onMoveCombatant={noop}
          onPlaceCombatant={noop}
        />
      )}

      {mapView === "room" && display.zones.length > 0 && (
        <ZoneMap
          zones={display.zones}
          zoneEffects={display.zoneEffects}
          combatants={sorted}
          activeId={activeId}
          canEdit={false}
          onAddZone={noop}
          onUpdateZone={noop}
          onDeleteZone={noop}
          onToggleConnection={noop}
          onAddEffect={noop}
          onRemoveEffect={noop}
          onMoveCombatant={noop}
          onLoadTemplate={noop}
          onLoadDungeonRoom={noop}
        />
      )}
    </div>
  );
}
