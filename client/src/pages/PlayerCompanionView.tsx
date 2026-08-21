import { useEffect, useState } from "react";
import type { Encounter, LiveCombatant, PlayerCharacter, DeathSaves, SpellSlotLevel, ClassResource } from "@spark/shared";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useActiveWorld } from "../ActiveWorldContext";
import { useWorldLiveChannel } from "../useWorldLiveChannel";
import { useMyTurnNotifier } from "../useMyTurnNotifier";
import { useSessionReminder } from "../useSessionReminder";
import { useLocalStorage } from "../useLocalStorage";
import { DiceRoller } from "../components/DiceRoller";
import { ChatPanel } from "../components/ChatPanel";
import { GridMap } from "../components/GridMap";
import { LastSessionPanel } from "../components/LastSessionPanel";
import { NextSessionPanel } from "../components/NextSessionPanel";
import { HpTrackerPanel } from "../components/HpTrackerPanel";
import { DeathSavesPanel } from "../components/DeathSavesPanel";
import { SpellSlotsPanel } from "../components/SpellSlotsPanel";
import { PreparedSpellsPanel } from "../components/PreparedSpellsPanel";
import { ClassResourcePanel } from "../components/ClassResourcePanel";
import { AccountMenu } from "../components/AccountMenu";
import { ThemeToggle } from "../components/ThemeToggle";

function backToDesktopHref(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete("play");
  return `${url.pathname}${url.search}`;
}

function TurnOrderStrip({ combatants, activeId }: { combatants: LiveCombatant[]; activeId: string | null }) {
  if (combatants.length === 0) {
    return <p className="hint">No active combat right now.</p>;
  }
  const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);

  return (
    <ol className="player-companion-turn-strip">
      {sorted.map((c) => (
        <li key={c.id} className={`player-companion-combatant${c.id === activeId ? " active-turn" : ""}`}>
          <span className="entity-name">{c.name}</span>
          {c.currentHp !== undefined && c.maxHp !== undefined ? (
            <span className="combatant-hp-value mono">{c.currentHp} / {c.maxHp} HP</span>
          ) : (
            <span className={`hp-status-badge hp-status-${c.hpStatus}`}>{c.hpStatus}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

function CharacterPanel({ pc, isMyTurn, onRefresh }: { pc: PlayerCharacter; isMyTurn: boolean; onRefresh: () => void }) {
  const [hp, setHp] = useState(pc.currentHp);
  const [saves, setSaves] = useState<DeathSaves>(pc.deathSaves);
  const [slots, setSlots] = useState<SpellSlotLevel[]>(pc.spellSlots);
  const [prepared, setPrepared] = useState<string[]>(pc.preparedSpells);
  const [resources, setResources] = useState<ClassResource[]>(pc.classResources);
  const [resting, setResting] = useState(false);

  useEffect(() => {
    setHp(pc.currentHp);
    setSaves(pc.deathSaves);
    setSlots(pc.spellSlots);
    setPrepared(pc.preparedSpells);
    setResources(pc.classResources);
  }, [pc]);

  async function handleRest(kind: "short" | "long") {
    setResting(true);
    try {
      await api.restPlayerCharacter(pc.id, kind);
      onRefresh();
    } finally {
      setResting(false);
    }
  }

  return (
    <div className={`player-companion-character panel${isMyTurn ? " my-turn" : ""}`}>
      <div className="section-heading-row">
        <h3 className="section-heading">{pc.name}</h3>
        {isMyTurn && <span className="my-turn-badge">⚔ Your Turn</span>}
      </div>
      <p className="entity-meta">{pc.className} {pc.level} · {pc.race}</p>

      <HpTrackerPanel currentHp={hp} maxHp={pc.maxHp} onChange={(v) => { setHp(v); api.updatePlayerCharacter(pc.id, { currentHp: v }); }} />
      <DeathSavesPanel deathSaves={saves} onChange={(v) => { setSaves(v); api.updatePlayerCharacter(pc.id, { deathSaves: v }); }} />
      <SpellSlotsPanel spellSlots={slots} onChange={(v) => { setSlots(v); api.updatePlayerCharacter(pc.id, { spellSlots: v }); }} />
      <PreparedSpellsPanel preparedSpells={prepared} className={pc.className} onChange={(v) => { setPrepared(v); api.updatePlayerCharacter(pc.id, { preparedSpells: v }); }} />
      <ClassResourcePanel resource={resources[0]} onChange={(v) => { setResources([v]); api.updatePlayerCharacter(pc.id, { classResources: [v] }); }} />

      <div className="button-row">
        <button className="btn-secondary" onClick={() => handleRest("short")} disabled={resting}>Short Rest</button>
        <button className="btn-secondary" onClick={() => handleRest("long")} disabled={resting}>Long Rest</button>
      </div>
    </div>
  );
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export function PlayerCompanionView() {
  const { user } = useAuth();
  const { worlds, worldId, setWorldId, refreshWorlds, loading: worldsLoading } = useActiveWorld();
  const [characters, setCharacters] = useState<PlayerCharacter[]>([]);
  const [notifyEnabled, setNotifyEnabled] = useLocalStorage("spark-notify-my-turn", false);
  const [notifyBlocked, setNotifyBlocked] = useState(false);
  const [sessionRemindEnabled, setSessionRemindEnabled] = useLocalStorage("spark-notify-next-session", false);
  const [sessionRemindBlocked, setSessionRemindBlocked] = useState(false);

  const world = worlds.find((w) => w.id === worldId) ?? null;
  const canEdit = world?.isOwner ?? false;
  const [showGridMap, setShowGridMap] = useState(false);
  useSessionReminder(world?.nextSessionAt, sessionRemindEnabled);

  function refreshCharacters() {
    api.listMyPlayerCharacters().then(setCharacters).catch(() => {});
  }

  useEffect(refreshCharacters, []);

  // First-time visitors who've never picked a world in the full desktop app
  // (spark-active-world-id localStorage key still empty) land here with
  // nothing selected — auto-pick when there's only one obvious choice.
  useEffect(() => {
    if (!worldId && worlds.length === 1) setWorldId(worlds[0].id);
  }, [worldId, worlds, setWorldId]);

  const myCharactersHere = characters.filter((pc) => pc.worldId === worldId);
  const myPlayerCharacterIds = myCharactersHere.map((pc) => pc.id);

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  useWorldLiveChannel(worldId, {
    onEncounter: setEncounter,
    onTokenMoved: (payload) => {
      setEncounter((e) => e && ({
        ...e,
        combatants: e.combatants.map((c) => (c.id === payload.combatantId ? { ...c, gridX: payload.gridX, gridY: payload.gridY } : c)),
      }));
    },
  });
  useMyTurnNotifier(encounter, myPlayerCharacterIds, notifyEnabled);
  const combatants = encounter?.combatants ?? [];
  const sortedCombatants = [...combatants].sort((a, b) => b.initiative - a.initiative);
  const activeCombatant = combatants.length > 0 ? sortedCombatants[(encounter?.turnIndex ?? 0) % sortedCombatants.length] ?? null : null;
  const activeId = activeCombatant?.id ?? null;

  function loadBattleMap(mapId: string) {
    if (!worldId || !encounter) return;
    api.saveEncounter(worldId, { ...encounter, activeBattleMapId: mapId }).then(setEncounter).catch(() => {});
  }

  function leaveBattleMap() {
    if (!worldId || !encounter) return;
    api.saveEncounter(worldId, {
      ...encounter,
      activeBattleMapId: undefined,
      combatants: encounter.combatants.map((c) => ({ ...c, gridX: undefined, gridY: undefined })),
    }).then(setEncounter).catch(() => {});
  }

  function moveCombatantOnGrid(combatantId: string, gridX: number, gridY: number) {
    if (!worldId) return;
    if (canEdit && encounter) {
      api.saveEncounter(worldId, {
        ...encounter,
        combatants: encounter.combatants.map((c) => (c.id === combatantId ? { ...c, gridX, gridY } : c)),
      }).then(setEncounter).catch(() => {});
    } else {
      api.moveCombatantGrid(worldId, combatantId, gridX, gridY).then(setEncounter).catch(() => {});
    }
  }

  // Ephemeral, unpersisted — see the identical note on
  // InitiativeTracker.tsx's broadcastTokenDrag.
  function broadcastTokenDrag(combatantId: string, gridX: number, gridY: number) {
    if (!worldId) return;
    api.broadcastTokenPosition(worldId, combatantId, gridX, gridY).catch(() => {});
  }

  async function handleToggleNotify() {
    if (notifyEnabled) {
      setNotifyEnabled(false);
      return;
    }
    const granted = await ensureNotificationPermission();
    if (granted) {
      setNotifyEnabled(true);
      setNotifyBlocked(false);
    } else {
      setNotifyBlocked(true);
    }
  }

  async function handleToggleSessionRemind() {
    if (sessionRemindEnabled) {
      setSessionRemindEnabled(false);
      return;
    }
    const granted = await ensureNotificationPermission();
    if (granted) {
      setSessionRemindEnabled(true);
      setSessionRemindBlocked(false);
    } else {
      setSessionRemindBlocked(true);
    }
  }

  return (
    <div className="player-companion">
      <header className="player-companion-header">
        <a className="btn-secondary player-companion-exit" href={backToDesktopHref()} aria-label="Back to full app">← Full App</a>
        <h1>Spark</h1>
        <div className="player-companion-header-actions">
          <ThemeToggle />
          <AccountMenu />
        </div>
      </header>

      {worldsLoading ? (
        <p className="hint">Loading…</p>
      ) : worlds.length === 0 ? (
        <p className="hint">You're not in any worlds yet — join one from the full app.</p>
      ) : (
        <>
          {worlds.length > 1 && (
            <label className="field">
              <span>World</span>
              <select value={worldId} onChange={(e) => setWorldId(e.target.value)}>
                <option value="">Select a world…</option>
                {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
          )}

          {worldId && world && (world.isOwner || world.nextSessionAt) && (
            <section className="panel">
              <div className="section-heading-row">
                <h2 className="section-heading">Next Session</h2>
                <button className="btn-secondary" onClick={handleToggleSessionRemind}>
                  {sessionRemindEnabled ? "🔔 Remind me: On" : "🔕 Remind me: Off"}
                </button>
              </div>
              {sessionRemindBlocked && (
                <p className="hint">Notifications are blocked — enable them in your browser's site settings to use this.</p>
              )}
              <NextSessionPanel world={world} onUpdated={refreshWorlds} />
            </section>
          )}

          {worldId && (
            <>
              <LastSessionPanel worldId={worldId} />

              <section className="panel">
                <div className="section-heading-row">
                  <h2 className="section-heading">Turn Order</h2>
                  <button className="btn-secondary" onClick={handleToggleNotify}>
                    {notifyEnabled ? "🔔 Notify on my turn: On" : "🔕 Notify on my turn: Off"}
                  </button>
                </div>
                {notifyBlocked && (
                  <p className="hint">Notifications are blocked — enable them in your browser's site settings to use this.</p>
                )}
                <TurnOrderStrip combatants={combatants} activeId={activeId} />
              </section>

              {(encounter?.activeBattleMapId || canEdit) && (
                <section className="panel">
                  <div className="section-heading-row">
                    <h2 className="section-heading">Battle Grid</h2>
                    <button className="btn-secondary" aria-expanded={showGridMap} onClick={() => setShowGridMap((v) => !v)}>
                      {showGridMap ? "Hide" : "Show"}
                    </button>
                  </div>
                  {showGridMap && (
                    <GridMap
                      worldId={worldId}
                      battleMapId={encounter?.activeBattleMapId}
                      combatants={combatants}
                      activeId={activeId}
                      canEdit={canEdit}
                      exploredCells={encounter?.exploredCells}
                      visibleCells={encounter?.visibleCells}
                      onLoadBattleMap={loadBattleMap}
                      onLeaveBattleMap={leaveBattleMap}
                      onMoveCombatant={moveCombatantOnGrid}
                      onPlaceCombatant={moveCombatantOnGrid}
                      onDragBroadcast={broadcastTokenDrag}
                    />
                  )}
                </section>
              )}

              <ChatPanel worldId={worldId} worlds={worlds} />

              <section className="panel">
                <DiceRoller worlds={worlds} partyWorldId={worldId} setPartyWorldId={setWorldId} initialMode="party" />
              </section>

              {myCharactersHere.map((pc) => (
                <CharacterPanel key={pc.id} pc={pc} isMyTurn={activeCombatant?.playerCharacterId === pc.id} onRefresh={refreshCharacters} />
              ))}
            </>
          )}
        </>
      )}

      <a className="player-companion-back-link" href={backToDesktopHref()}>
        {user ? `Signed in as ${user.displayName || user.username} — Full App` : "Full App"}
      </a>
    </div>
  );
}
