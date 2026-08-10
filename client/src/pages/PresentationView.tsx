import { useEffect, useState } from "react";
import type { Dungeon, Encounter, HpStatus } from "@spark/shared";
import { api } from "../api";
import { ZoneMap } from "../components/ZoneMap";
import { DungeonMapView } from "../components/DungeonMapView";
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
  const [mapView, setMapView] = useState<"room" | "dungeon">("room");

  const { error: liveError } = useWorldLiveChannel(worldId, { onEncounter: setEncounter });
  useEffect(() => { if (liveError) setError(liveError); }, [liveError]);

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

  const display = filterEncounterForDisplay(encounter);
  const sorted = [...display.combatants].sort((a, b) => b.initiative - a.initiative);
  const activeId = sorted.length > 0 ? sorted[display.turnIndex % sorted.length]?.id ?? null : null;

  return (
    <div className="presentation-view">
      <div className="presentation-header">
        <span className="round-banner">Round {display.round}</span>
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

      {activeDungeon && (
        <div className="button-row">
          <button className={mapView === "room" ? "active" : ""} aria-current={mapView === "room" ? "true" : undefined} onClick={() => setMapView("room")}>Room View</button>
          <button className={mapView === "dungeon" ? "active" : ""} aria-current={mapView === "dungeon" ? "true" : undefined} onClick={() => setMapView("dungeon")}>Dungeon Map</button>
        </div>
      )}

      {mapView === "dungeon" && activeDungeon && (
        <DungeonMapView dungeon={activeDungeon} canEdit={false} onUpdateRoomRect={noop} />
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
