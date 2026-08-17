import { useEffect, useState } from "react";
import type { Encounter, PlayerCharacter, DeathSaves, SpellSlotLevel, ClassResource } from "@spark/shared";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useActiveWorld } from "../ActiveWorldContext";
import { useWorldLiveChannel } from "../useWorldLiveChannel";
import { useMyTurnNotifier } from "../useMyTurnNotifier";
import { useLocalStorage } from "../useLocalStorage";
import { DiceRoller } from "../components/DiceRoller";
import { ChatPanel } from "../components/ChatPanel";
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

function TurnOrderStrip({ worldId, myPlayerCharacterIds, notifyEnabled }: { worldId: string; myPlayerCharacterIds: string[]; notifyEnabled: boolean }) {
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  useWorldLiveChannel(worldId, { onEncounter: setEncounter });
  useMyTurnNotifier(encounter, myPlayerCharacterIds, notifyEnabled);

  if (!encounter || encounter.combatants.length === 0) {
    return <p className="hint">No active combat right now.</p>;
  }
  const sorted = [...encounter.combatants].sort((a, b) => b.initiative - a.initiative);
  const activeId = sorted[encounter.turnIndex % sorted.length]?.id ?? null;

  return (
    <ol className="player-companion-turn-strip">
      {sorted.map((c) => (
        <li key={c.id} className={`player-companion-combatant${c.id === activeId ? " active-turn" : ""}`}>
          <span className="entity-name">{c.name}</span>
          {c.currentHp !== undefined && c.maxHp !== undefined ? (
            <span className="combatant-hp-value">{c.currentHp} / {c.maxHp} HP</span>
          ) : (
            <span className={`hp-status-badge hp-status-${c.hpStatus}`}>{c.hpStatus}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

function CharacterPanel({ pc, onRefresh }: { pc: PlayerCharacter; onRefresh: () => void }) {
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
    <div className="player-companion-character panel">
      <h3 className="section-heading">{pc.name}</h3>
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

export function PlayerCompanionView() {
  const { user } = useAuth();
  const { worlds, worldId, setWorldId } = useActiveWorld();
  const [characters, setCharacters] = useState<PlayerCharacter[]>([]);
  const [notifyEnabled, setNotifyEnabled] = useLocalStorage("spark-notify-my-turn", false);
  const [notifyBlocked, setNotifyBlocked] = useState(false);

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

  async function handleToggleNotify() {
    if (notifyEnabled) {
      setNotifyEnabled(false);
      return;
    }
    if (typeof Notification === "undefined") {
      setNotifyBlocked(true);
      return;
    }
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission === "granted") {
      setNotifyEnabled(true);
      setNotifyBlocked(false);
    } else {
      setNotifyBlocked(true);
    }
  }

  return (
    <div className="player-companion">
      <header className="player-companion-header">
        <h1>Spark</h1>
        <div className="player-companion-header-actions">
          <ThemeToggle />
          <AccountMenu />
        </div>
      </header>

      {worlds.length === 0 ? (
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

          {worldId && (
            <>
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
                <TurnOrderStrip worldId={worldId} myPlayerCharacterIds={myPlayerCharacterIds} notifyEnabled={notifyEnabled} />
              </section>

              <ChatPanel worldId={worldId} worlds={worlds} />

              <section className="panel">
                <DiceRoller worlds={worlds} partyWorldId={worldId} setPartyWorldId={setWorldId} initialMode="party" />
              </section>

              {myCharactersHere.map((pc) => (
                <CharacterPanel key={pc.id} pc={pc} onRefresh={refreshCharacters} />
              ))}
            </>
          )}
        </>
      )}

      <a className="player-companion-back-link" href={backToDesktopHref()}>
        {user ? `Signed in as ${user.username} — Full App` : "Full App"}
      </a>
    </div>
  );
}
