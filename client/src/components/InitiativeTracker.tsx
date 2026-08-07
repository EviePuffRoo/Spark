import { useEffect, useState } from "react";
import type { SearchResult, LiveCombatant, EncounterStateInput, EncounterTable, EncounterZone, HpStatus, Dungeon } from "@spark/shared";
import { api, type WorldSummary } from "../api";
import { EntitySearchPicker } from "./EntitySearchPicker";
import { ZoneMap } from "./ZoneMap";
import { useLocalStorage } from "../useLocalStorage";
import { rollTableIndex } from "../rollTable";
import { computeDifficulty, type DifficultyRating } from "../encounterDifficulty";

const CONDITIONS = [
  "Blinded", "Charmed", "Deafened", "Exhausted", "Frightened", "Grappled",
  "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned",
  "Prone", "Restrained", "Stunned", "Unconscious",
];

const CONDITION_RULES: Record<string, string> = {
  Blinded: "Can't see, and automatically fails any check that requires sight. Attack rolls against the creature have advantage, and its own attack rolls have disadvantage.",
  Charmed: "Can't attack the charmer or target them with harmful abilities. The charmer has advantage on social ability checks against the creature.",
  Deafened: "Can't hear, and automatically fails any check that requires hearing.",
  Exhausted: "Cumulative levels (1–6) each add a penalty: disadvantage on ability checks, halved speed, disadvantage on attacks and saves, halved max HP, speed reduced to 0, then death.",
  Frightened: "Disadvantage on ability checks and attack rolls while the source of fear is in sight, and can't willingly move closer to it.",
  Grappled: "Speed becomes 0. Ends if the grappler is incapacitated or the creature is moved out of the grappler's reach.",
  Incapacitated: "Can't take actions or reactions.",
  Invisible: "Can't be seen without special senses or magic. Attack rolls against the creature have disadvantage, and its own attack rolls have advantage.",
  Paralyzed: "Incapacitated, can't move or speak. Automatically fails Strength and Dexterity saves. Attacks against it have advantage, and hits from within 5 feet are automatic critical hits.",
  Petrified: "Transformed to stone, incapacitated, can't move or speak, unaware of surroundings. Resistant to all damage, and immune to poison and disease.",
  Poisoned: "Disadvantage on attack rolls and ability checks.",
  Prone: "Can only crawl unless it stands up (costing half its speed). Disadvantage on attack rolls. Attacks against it have advantage from within 5 feet, disadvantage otherwise.",
  Restrained: "Speed becomes 0. Disadvantage on attack rolls and Dexterity saves. Attacks against it have advantage.",
  Stunned: "Incapacitated, can't move, and can speak only falteringly. Automatically fails Strength and Dexterity saves. Attacks against it have advantage.",
  Unconscious: "Incapacitated, can't move or speak, unaware of surroundings, drops what it's holding, and falls prone. Automatically fails Strength and Dexterity saves. Attacks against it have advantage, and hits from within 5 feet are automatic critical hits.",
};

const HP_STATUS_LABELS: Record<HpStatus, string> = {
  healthy: "Healthy",
  injured: "Injured",
  bloodied: "Bloodied",
  nearDeath: "Near Death",
  down: "Down",
};

const BLANK_ENCOUNTER: EncounterStateInput = { combatants: [], round: 1, turnIndex: 0, zones: [], zoneEffects: [] };
const POLL_INTERVAL_MS = 5000;

const DIFFICULTY_LABELS: Record<DifficultyRating, string> = {
  trivial: "Trivial", easy: "Easy", medium: "Medium", hard: "Hard", deadly: "Deadly",
};

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

export function InitiativeTracker({
  worlds, partyWorldId, setPartyWorldId,
}: {
  worlds: WorldSummary[];
  partyWorldId: string;
  setPartyWorldId: (id: string) => void;
}) {
  const [encounter, setEncounter] = useLocalStorage<EncounterStateInput>("spark-combat-encounter", BLANK_ENCOUNTER);
  const [mode, setMode] = useState<"personal" | "party">("personal");
  const [liveEncounter, setLiveEncounter] = useState<EncounterStateInput | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  const [rosterPickType, setRosterPickType] = useState<"character" | "playerCharacter" | "encounterTable" | null>(null);
  const [pickedTable, setPickedTable] = useState<EncounterTable | null>(null);
  const [rolledTableIndex, setRolledTableIndex] = useState<number | null>(null);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customInitiative, setCustomInitiative] = useState(10);
  const [customMaxHp, setCustomMaxHp] = useState(10);
  const [customAc, setCustomAc] = useState<number | "">("");
  const [customXp, setCustomXp] = useState<number | "">("");
  const [customLevel, setCustomLevel] = useState<number | "">("");
  const [hpDelta, setHpDelta] = useState<Record<string, string>>({});
  const [openConditionsFor, setOpenConditionsFor] = useState<string | null>(null);
  const [showConditionRules, setShowConditionRules] = useState(false);
  const [showZoneMap, setShowZoneMap] = useState(false);
  const [activeDungeon, setActiveDungeon] = useState<Dungeon | null>(null);

  const partyMode = mode === "party";
  const selectedWorld = worlds.find((w) => w.id === partyWorldId) ?? null;
  const isOwner = partyMode && !!selectedWorld?.isOwner;
  const canEdit = !partyMode || isOwner;

  useEffect(() => {
    if (!partyMode || !partyWorldId) {
      setLiveEncounter(null);
      return;
    }
    let cancelled = false;
    function load() {
      api.getEncounter(partyWorldId)
        .then((row) => { if (!cancelled) setLiveEncounter(row); })
        .catch((e) => { if (!cancelled) setLiveError((e as Error).message); });
    }
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [partyMode, partyWorldId]);

  const activeEncounter: EncounterStateInput = partyMode ? (liveEncounter ?? BLANK_ENCOUNTER) : encounter;

  // Older saved encounters (before conditions/kind/hpVisible/zones existed) won't have these fields.
  const sorted = [...activeEncounter.combatants]
    .map((c) => ({ ...c, conditions: c.conditions ?? [], kind: c.kind ?? "custom", hpVisible: c.hpVisible ?? false }))
    .sort((a, b) => b.initiative - a.initiative);
  const activeId = sorted.length > 0 ? sorted[activeEncounter.turnIndex % sorted.length]?.id : null;
  const difficulty = computeDifficulty(sorted);
  const zones = activeEncounter.zones ?? [];
  const zoneEffects = activeEncounter.zoneEffects ?? [];

  useEffect(() => {
    const dungeonId = activeEncounter.activeDungeonId;
    if (!canEdit || !dungeonId) {
      setActiveDungeon(null);
      return;
    }
    let cancelled = false;
    api.getDungeon(dungeonId)
      .then((d) => { if (!cancelled) setActiveDungeon(d); })
      .catch(() => { if (!cancelled) setActiveDungeon(null); });
    return () => { cancelled = true; };
  }, [canEdit, activeEncounter.activeDungeonId]);

  function applyEncounterUpdate(updater: (e: EncounterStateInput) => EncounterStateInput) {
    if (partyMode && isOwner && partyWorldId) {
      setLiveEncounter((e) => {
        const next = updater(e ?? BLANK_ENCOUNTER);
        api.saveEncounter(partyWorldId, next).catch((err) => setLiveError((err as Error).message));
        return next;
      });
    } else {
      setEncounter(updater);
    }
  }

  function addCombatant(c: LiveCombatant) {
    applyEncounterUpdate((e) => ({ ...e, combatants: [...e.combatants, c] }));
  }

  async function handlePickFromRoster(result: SearchResult) {
    const type = rosterPickType;
    if (type === "encounterTable") {
      const table = await api.getEncounterTable(result.id);
      setPickedTable(table);
      setRolledTableIndex(null);
      return;
    }
    setRosterPickType(null);
    if (type === "character") {
      const character = await api.getCharacter(result.id);
      addCombatant({
        id: crypto.randomUUID(),
        name: character.name,
        kind: "monster",
        initiative: rollD20() + abilityModifier(character.statBlock.abilityScores.dex),
        maxHp: character.statBlock.hitPointsAverage,
        currentHp: character.statBlock.hitPointsAverage,
        hpStatus: "healthy",
        armorClass: character.statBlock.armorClass,
        conditions: [],
        notes: "",
        hpVisible: false,
        xp: character.statBlock.xp,
      });
    } else if (type === "playerCharacter") {
      const pc = await api.getPlayerCharacter(result.id);
      addCombatant({
        id: crypto.randomUUID(),
        name: pc.name,
        kind: "playerCharacter",
        initiative: rollD20() + abilityModifier(pc.abilityScores.dex),
        maxHp: pc.maxHp,
        currentHp: pc.maxHp,
        hpStatus: "healthy",
        armorClass: pc.armorClass,
        conditions: [],
        notes: "",
        hpVisible: true,
        level: pc.level,
      });
    }
  }

  function rollOnPickedTable() {
    if (!pickedTable) return;
    setRolledTableIndex(rollTableIndex(pickedTable.entries));
  }

  function addRolledTableEntryToCombat() {
    if (!pickedTable || rolledTableIndex === null) return;
    const entry = pickedTable.entries[rolledTableIndex];
    addCombatant({
      id: crypto.randomUUID(),
      name: entry.description,
      kind: "custom",
      initiative: 10,
      maxHp: 10,
      currentHp: 10,
      hpStatus: "healthy",
      conditions: [],
      notes: "",
      hpVisible: false,
    });
  }

  function handleAddCustom() {
    if (!customName.trim()) return;
    addCombatant({
      id: crypto.randomUUID(),
      name: customName.trim(),
      kind: "custom",
      initiative: Number(customInitiative) || 0,
      maxHp: Number(customMaxHp) || 1,
      currentHp: Number(customMaxHp) || 1,
      hpStatus: "healthy",
      armorClass: customAc === "" ? undefined : Number(customAc),
      conditions: [],
      notes: "",
      hpVisible: false,
      xp: customXp === "" ? undefined : Number(customXp),
      level: customLevel === "" ? undefined : Number(customLevel),
    });
    setCustomName("");
    setCustomInitiative(10);
    setCustomMaxHp(10);
    setCustomAc("");
    setCustomXp("");
    setCustomLevel("");
    setAddingCustom(false);
  }

  function updateCombatant(id: string, patch: Partial<LiveCombatant>) {
    applyEncounterUpdate((e) => ({ ...e, combatants: e.combatants.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  }

  function toggleCondition(id: string, condition: string) {
    applyEncounterUpdate((e) => ({
      ...e,
      combatants: e.combatants.map((c) => {
        if (c.id !== id) return c;
        const conditions = c.conditions ?? [];
        return { ...c, conditions: conditions.includes(condition) ? conditions.filter((x) => x !== condition) : [...conditions, condition] };
      }),
    }));
  }

  function adjustHp(id: string, delta: number) {
    applyEncounterUpdate((e) => ({
      ...e,
      combatants: e.combatants.map((c) =>
        c.id === id ? { ...c, currentHp: Math.max(0, Math.min(c.maxHp ?? 0, (c.currentHp ?? 0) + delta)) } : c
      ),
    }));
  }

  function applyDelta(id: string, sign: 1 | -1) {
    const amount = Number(hpDelta[id]);
    if (!hpDelta[id] || Number.isNaN(amount) || amount <= 0) return;
    adjustHp(id, sign * amount);
    setHpDelta((d) => ({ ...d, [id]: "" }));
  }

  function removeCombatant(id: string) {
    applyEncounterUpdate((e) => ({ ...e, combatants: e.combatants.filter((c) => c.id !== id) }));
  }

  function nextTurn() {
    applyEncounterUpdate((e) => {
      const count = e.combatants.length;
      if (count === 0) return e;
      const next = e.turnIndex + 1;
      return next >= count ? { ...e, turnIndex: 0, round: e.round + 1 } : { ...e, turnIndex: next };
    });
  }

  function clearEncounter() {
    if (!confirm("Clear the current encounter? This cannot be undone.")) return;
    applyEncounterUpdate(() => BLANK_ENCOUNTER);
  }

  function restCombatant(id: string) {
    applyEncounterUpdate((e) => ({
      ...e,
      combatants: e.combatants.map((c) => (c.id === id ? { ...c, currentHp: c.maxHp ?? 0, conditions: [] } : c)),
    }));
  }

  function restAll() {
    if (!confirm("Rest the whole party? Everyone's HP will be restored to max and all conditions cleared.")) return;
    applyEncounterUpdate((e) => ({
      ...e,
      combatants: e.combatants.map((c) => ({ ...c, currentHp: c.maxHp ?? 0, conditions: [] })),
    }));
  }

  function addZone() {
    applyEncounterUpdate((e) => {
      const zones = e.zones ?? [];
      const newZone: EncounterZone = {
        id: crypto.randomUUID(),
        name: `Zone ${zones.length + 1}`,
        tags: [],
        x: 100 + (zones.length % 4) * 140,
        y: 100 + Math.floor(zones.length / 4) * 140,
        connections: [],
        revealed: true,
      };
      return { ...e, zones: [...zones, newZone] };
    });
  }

  function updateZone(id: string, patch: Partial<EncounterZone>) {
    applyEncounterUpdate((e) => ({ ...e, zones: (e.zones ?? []).map((z) => (z.id === id ? { ...z, ...patch } : z)) }));
  }

  function deleteZone(id: string) {
    applyEncounterUpdate((e) => ({
      ...e,
      zones: (e.zones ?? []).filter((z) => z.id !== id).map((z) => ({ ...z, connections: z.connections.filter((c) => c !== id) })),
      zoneEffects: (e.zoneEffects ?? []).filter((eff) => eff.zoneId !== id),
      combatants: e.combatants.map((c) => (c.zoneId === id ? { ...c, zoneId: undefined } : c)),
    }));
  }

  function toggleZoneConnection(aId: string, bId: string) {
    applyEncounterUpdate((e) => ({
      ...e,
      zones: (e.zones ?? []).map((z) => {
        if (z.id !== aId) return z;
        const has = z.connections.includes(bId);
        return { ...z, connections: has ? z.connections.filter((c) => c !== bId) : [...z.connections, bId] };
      }),
    }));
  }

  function addZoneEffect(zoneId: string, label: string, durationRounds: number) {
    applyEncounterUpdate((e) => ({
      ...e,
      zoneEffects: [...(e.zoneEffects ?? []), { id: crypto.randomUUID(), zoneId, label, expiresAtRound: e.round + durationRounds }],
    }));
  }

  function removeZoneEffect(id: string) {
    applyEncounterUpdate((e) => ({ ...e, zoneEffects: (e.zoneEffects ?? []).filter((eff) => eff.id !== id) }));
  }

  function moveCombatantToZone(combatantId: string, zoneId: string) {
    if (canEdit) {
      applyEncounterUpdate((e) => ({ ...e, combatants: e.combatants.map((c) => (c.id === combatantId ? { ...c, zoneId } : c)) }));
    } else if (partyMode && partyWorldId) {
      api.moveCombatantZone(partyWorldId, combatantId, zoneId)
        .then(setLiveEncounter)
        .catch((err) => setLiveError((err as Error).message));
    }
  }

  function loadZoneMapTemplate(templateZones: EncounterZone[]) {
    const idMap = new Map<string, string>(templateZones.map((z) => [z.id, crypto.randomUUID()]));
    const remapped: EncounterZone[] = templateZones.map((z) => ({
      ...z,
      id: idMap.get(z.id)!,
      connections: z.connections.map((c) => idMap.get(c)).filter((c): c is string => !!c),
    }));
    applyEncounterUpdate((e) => ({ ...e, zones: [...(e.zones ?? []), ...remapped] }));
  }

  async function loadDungeonRoom(dungeonId: string, roomId: string) {
    const dungeon = await api.getDungeon(dungeonId);
    const room = dungeon.rooms.find((r) => r.id === roomId);
    if (!room) return;
    const template = await api.getZoneMapTemplate(room.templateId);
    applyEncounterUpdate((e) => ({
      ...e,
      zones: template.zones,
      zoneEffects: [],
      activeDungeonId: dungeonId,
      activeDungeonRoomId: roomId,
    }));
    setActiveDungeon(dungeon);
  }

  function leaveDungeon() {
    applyEncounterUpdate((e) => ({ ...e, activeDungeonId: undefined, activeDungeonRoomId: undefined }));
    setActiveDungeon(null);
  }

  return (
    <div className="panel result-panel initiative-tracker">
      <div className="initiative-header">
        <h2>Initiative Tracker</h2>
        <span className="round-banner">Round {activeEncounter.round}</span>
      </div>

      {worlds.length === 0 ? (
        <p className="hint">Create or join a world to run combat with your party.</p>
      ) : (
        <div className="tabs dice-mode-toggle" role="tablist">
          <button className={mode === "personal" ? "active" : ""} aria-current={mode === "personal" ? "true" : undefined} onClick={() => setMode("personal")}>Personal</button>
          <button className={partyMode ? "active" : ""} aria-current={partyMode ? "true" : undefined} onClick={() => setMode("party")}>Party</button>
        </div>
      )}

      {partyMode && worlds.length > 0 && (
        <label className="field">
          <span>World</span>
          <select value={partyWorldId} onChange={(e) => setPartyWorldId(e.target.value)}>
            <option value="">Select a world…</option>
            {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
      )}
      {partyMode && liveError && <p className="error">{liveError}</p>}

      {canEdit && difficulty && (
        <p className={`difficulty-readout difficulty-${difficulty.rating}`}>
          {DIFFICULTY_LABELS[difficulty.rating]} encounter — {difficulty.adjustedXp} XP (adjusted) vs. {difficulty.thresholds.easy}/{difficulty.thresholds.medium}/{difficulty.thresholds.hard}/{difficulty.thresholds.deadly} easy/medium/hard/deadly thresholds
        </p>
      )}

      <div className="button-row">
        {canEdit && (
          <button className="btn-secondary" aria-expanded={rosterPickType === "character"} onClick={() => { setRosterPickType(rosterPickType === "character" ? null : "character"); setAddingCustom(false); setPickedTable(null); }}>+ Add NPC/Monster</button>
        )}
        {canEdit && (
          <button className="btn-secondary" aria-expanded={rosterPickType === "playerCharacter"} onClick={() => { setRosterPickType(rosterPickType === "playerCharacter" ? null : "playerCharacter"); setAddingCustom(false); setPickedTable(null); }}>+ Add PC from Roster</button>
        )}
        {canEdit && (
          <button className="btn-secondary" aria-expanded={rosterPickType === "encounterTable"} onClick={() => { setRosterPickType(rosterPickType === "encounterTable" ? null : "encounterTable"); setAddingCustom(false); setPickedTable(null); }}>+ Add from Table</button>
        )}
        {canEdit && (
          <button className="btn-secondary" aria-expanded={addingCustom} onClick={() => { setAddingCustom((v) => !v); setRosterPickType(null); setPickedTable(null); }}>+ Add Custom</button>
        )}
        <button className="btn-secondary" aria-expanded={showConditionRules} onClick={() => setShowConditionRules((v) => !v)}>Condition Rules</button>
        <button className="btn-secondary" aria-expanded={showZoneMap} onClick={() => setShowZoneMap((v) => !v)}>{showZoneMap ? "Hide Zone Map" : "Show Zone Map"}</button>
        {canEdit && sorted.length > 0 && <button className="btn-secondary" onClick={nextTurn}>Next Turn</button>}
        {canEdit && sorted.length > 0 && <button className="btn-secondary" onClick={restAll}>Rest All</button>}
        {canEdit && sorted.length > 0 && <button className="btn-danger" onClick={clearEncounter}>Clear Encounter</button>}
      </div>

      {canEdit && activeDungeon && (
        <p className="hint">
          Dungeon: {activeDungeon.name}
          {activeEncounter.activeDungeonRoomId && ` — Room: ${activeDungeon.rooms.find((r) => r.id === activeEncounter.activeDungeonRoomId)?.name ?? ""}`}
          {" "}
          <button className="btn-secondary" onClick={leaveDungeon}>Leave Dungeon</button>
        </p>
      )}

      {showConditionRules && (
        <div className="save-panel condition-rules-panel">
          <h3 className="section-heading">Condition Rules</h3>
          <ul className="condition-rules-list">
            {CONDITIONS.map((cond) => (
              <li key={cond}>
                <strong>{cond}.</strong> {CONDITION_RULES[cond]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showZoneMap && (
        <ZoneMap
          zones={zones}
          zoneEffects={zoneEffects}
          combatants={sorted}
          activeId={activeId}
          canEdit={canEdit}
          worldId={partyMode ? partyWorldId : undefined}
          activeDungeon={activeDungeon}
          activeDungeonRoomId={activeEncounter.activeDungeonRoomId}
          onAddZone={addZone}
          onUpdateZone={updateZone}
          onDeleteZone={deleteZone}
          onToggleConnection={toggleZoneConnection}
          onAddEffect={addZoneEffect}
          onRemoveEffect={removeZoneEffect}
          onMoveCombatant={moveCombatantToZone}
          onLoadTemplate={loadZoneMapTemplate}
          onLoadDungeonRoom={loadDungeonRoom}
        />
      )}

      {canEdit && rosterPickType && !pickedTable && (
        <div className="save-panel">
          <EntitySearchPicker
            type={rosterPickType}
            onSelect={handlePickFromRoster}
            placeholder={
              rosterPickType === "character" ? "Search NPCs & monsters…" :
              rosterPickType === "playerCharacter" ? "Search player characters…" :
              "Search encounter tables…"
            }
          />
        </div>
      )}

      {canEdit && rosterPickType === "encounterTable" && pickedTable && (
        <div className="save-panel">
          <h3 className="section-heading">{pickedTable.name}</h3>
          <button className="btn-secondary" onClick={rollOnPickedTable}>Roll on this Table</button>
          {rolledTableIndex !== null && (
            <>
              <p className="encounter-roll-result" role="status">
                Rolled <strong>{pickedTable.entries[rolledTableIndex].roll}</strong>: {pickedTable.entries[rolledTableIndex].description}
              </p>
              <button className="btn-primary" onClick={addRolledTableEntryToCombat}>Add to Combat</button>
            </>
          )}
          <button className="btn-secondary" onClick={() => { setPickedTable(null); setRolledTableIndex(null); }}>Choose a different table</button>
        </div>
      )}

      {canEdit && addingCustom && (
        <div className="save-panel">
          <label className="field">
            <span>Name</span>
            <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. Aria (PC)" />
          </label>
          <label className="field">
            <span>Initiative</span>
            <input type="number" value={customInitiative} onChange={(e) => setCustomInitiative(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>Max HP</span>
            <input type="number" value={customMaxHp} onChange={(e) => setCustomMaxHp(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>AC (optional)</span>
            <input type="number" value={customAc} onChange={(e) => setCustomAc(e.target.value === "" ? "" : Number(e.target.value))} />
          </label>
          <label className="field">
            <span>XP value (optional, for difficulty calc)</span>
            <input type="number" value={customXp} onChange={(e) => setCustomXp(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 450 for a CR 8 monster" />
          </label>
          <label className="field">
            <span>Level (optional, if this is a PC)</span>
            <input type="number" value={customLevel} onChange={(e) => setCustomLevel(e.target.value === "" ? "" : Number(e.target.value))} />
          </label>
          <button className="btn-primary" onClick={handleAddCustom}>Add Combatant</button>
        </div>
      )}

      {sorted.length === 0 && (
        <p className="hint">
          {canEdit ? "No combatants yet. Add from the roster or add a custom entry (e.g. a PC)." : "No combat happening right now."}
        </p>
      )}

      <ul className="combatant-list">
        {sorted.map((c) => canEdit ? (
          <li key={c.id} className={`combatant-row${c.id === activeId ? " active-turn" : ""}${(c.currentHp ?? 0) <= 0 ? " down" : ""}`}>
            <div className="combatant-main">
              <input
                type="number"
                className="combatant-initiative"
                value={c.initiative}
                onChange={(e) => updateCombatant(c.id, { initiative: Number(e.target.value) })}
                aria-label={`${c.name} initiative`}
              />
              <span className="combatant-name">{c.name}</span>
              {c.armorClass !== undefined && <span className="entity-meta">AC {c.armorClass}</span>}
              <button className="btn-danger" onClick={() => removeCombatant(c.id)} aria-label={`Remove ${c.name}`}>Remove</button>
            </div>

            <div className="combatant-conditions">
              {c.conditions.map((cond) => (
                <span key={cond} className="condition-chip">
                  {cond}
                  <button onClick={() => toggleCondition(c.id, cond)} aria-label={`Remove ${cond} from ${c.name}`}>×</button>
                </span>
              ))}
              <button className="btn-secondary condition-toggle" aria-expanded={openConditionsFor === c.id} onClick={() => setOpenConditionsFor(openConditionsFor === c.id ? null : c.id)}>
                + Condition
              </button>
              {openConditionsFor === c.id && (
                <div className="condition-picker">
                  {CONDITIONS.map((cond) => (
                    <button
                      key={cond}
                      className={c.conditions.includes(cond) ? "active" : ""}
                      onClick={() => toggleCondition(c.id, cond)}
                    >
                      {cond}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="combatant-notes-row">
              <input
                type="text"
                className="combatant-notes"
                value={c.notes}
                onChange={(e) => updateCombatant(c.id, { notes: e.target.value })}
                placeholder="other notes…"
              />
            </div>

            <div className="combatant-hp">
              <span className="combatant-hp-value">{c.currentHp ?? 0} / {c.maxHp ?? 0} HP</span>
              <input
                type="number"
                className="combatant-hp-input"
                value={hpDelta[c.id] ?? ""}
                onChange={(e) => setHpDelta((d) => ({ ...d, [c.id]: e.target.value }))}
                placeholder="amount"
                aria-label={`HP change amount for ${c.name}`}
              />
              <button className="btn-danger" onClick={() => applyDelta(c.id, -1)}>Damage</button>
              <button className="btn-secondary" onClick={() => applyDelta(c.id, 1)}>Heal</button>
              <button className="btn-secondary" onClick={() => restCombatant(c.id)} aria-label={`Rest ${c.name}`}>Rest</button>
              {partyMode && (
                <button className="btn-secondary" onClick={() => updateCombatant(c.id, { hpVisible: !c.hpVisible })} aria-pressed={c.hpVisible}>
                  {c.hpVisible ? "Hide HP" : "Show HP"}
                </button>
              )}
              {partyMode && (
                <button className="btn-secondary" onClick={() => updateCombatant(c.id, { hidden: !c.hidden })} aria-pressed={!!c.hidden}>
                  {c.hidden ? "Reveal on Map" : "Hide from Map"}
                </button>
              )}
            </div>
          </li>
        ) : (
          <li key={c.id} className={`combatant-row read-only${c.id === activeId ? " active-turn" : ""}${c.hpStatus === "down" ? " down" : ""}`}>
            <div className="combatant-main">
              <span className="combatant-initiative-readonly">{c.initiative}</span>
              <span className="combatant-name">{c.name}</span>
              {c.armorClass !== undefined && <span className="entity-meta">AC {c.armorClass}</span>}
            </div>

            {c.conditions.length > 0 && (
              <div className="combatant-conditions">
                {c.conditions.map((cond) => (
                  <span key={cond} className="condition-chip condition-chip-readonly">{cond}</span>
                ))}
              </div>
            )}

            <div className="combatant-hp">
              {c.currentHp !== undefined && c.maxHp !== undefined ? (
                <span className="combatant-hp-value">{c.currentHp} / {c.maxHp} HP</span>
              ) : (
                <span className={`hp-status-badge hp-status-${c.hpStatus}`}>{HP_STATUS_LABELS[c.hpStatus]}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
