import { useEffect, useState } from "react";
import type { SearchResult, LiveCombatant, LiveCombatantCondition, EncounterStateInput, EncounterTable, EncounterZone, HpStatus, Dungeon, Item } from "@spark/shared";
import { computeEquipmentBonuses, CONDITIONS_COMPENDIUM, parseStatBlockAttacks } from "@spark/shared";
import { api, type WorldSummary } from "../api";
import { useAuth } from "../AuthContext";
import { EntitySearchPicker } from "./EntitySearchPicker";
import { ZoneMap } from "./ZoneMap";
import { useLocalStorage } from "../useLocalStorage";
import { useWorldLiveChannel } from "../useWorldLiveChannel";
import { rollTableIndex } from "../rollTable";
import { computeDifficulty, type DifficultyRating } from "../encounterDifficulty";
import { CombatIcon } from "./icons";
import { EmptyState } from "./EmptyState";
import { PresentationView } from "../pages/PresentationView";
import { parseNotation, rollDice } from "./DiceRoller";

const CONDITIONS = CONDITIONS_COMPENDIUM.map((c) => c.name);
const CONDITION_RULES: Record<string, string> = Object.fromEntries(
  CONDITIONS_COMPENDIUM.map((c) => [c.name, c.description]),
);

const HP_STATUS_LABELS: Record<HpStatus, string> = {
  healthy: "Healthy",
  injured: "Injured",
  bloodied: "Bloodied",
  nearDeath: "Near Death",
  down: "Down",
};

const BLANK_ENCOUNTER: EncounterStateInput = { combatants: [], round: 1, turnIndex: 0, zones: [], zoneEffects: [] };

const DIFFICULTY_LABELS: Record<DifficultyRating, string> = {
  trivial: "Trivial", easy: "Easy", medium: "Medium", hard: "Hard", deadly: "Deadly",
};

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function HpBar({ current, max }: { current: number; max: number }) {
  if (max <= 0) return null;
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const state = pct <= 25 ? "critical" : pct <= 50 ? "low" : "ok";
  return (
    <div className="hp-bar" role="progressbar" aria-valuenow={current} aria-valuemin={0} aria-valuemax={max}>
      <div className={`hp-bar-fill hp-bar-${state}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

async function equipmentAcBonusFor(equippedIds: string[], attunedIds: string[]): Promise<number> {
  if (equippedIds.length === 0) return 0;
  const items = await Promise.all(equippedIds.map((id) => api.getItem(id).catch(() => null)));
  const resolved = items.filter((i): i is Item => !!i);
  return computeEquipmentBonuses(resolved, equippedIds, attunedIds).armorClass;
}

export function InitiativeTracker({
  worlds, partyWorldId, setPartyWorldId,
}: {
  worlds: WorldSummary[];
  partyWorldId: string;
  setPartyWorldId: (id: string) => void;
}) {
  const { user } = useAuth();
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
  const [conditionDuration, setConditionDuration] = useState<Record<string, string>>({});
  const [showConditionRules, setShowConditionRules] = useState(false);
  const [attackOpenFor, setAttackOpenFor] = useState<string | null>(null);
  const [attackTargetId, setAttackTargetId] = useState("");
  const [attackChoice, setAttackChoice] = useState("");
  const [attackToHitBonus, setAttackToHitBonus] = useState("0");
  const [attackDamageDice, setAttackDamageDice] = useState("1d6");
  const [attackAdvMode, setAttackAdvMode] = useState<"normal" | "adv" | "dis">("normal");
  const [attackRollResult, setAttackRollResult] = useState<{ rolls: number[]; total: number; hit: boolean | null } | null>(null);
  const [attackDamageResult, setAttackDamageResult] = useState<{ total: number } | null>(null);
  const [attackError, setAttackError] = useState<string | null>(null);
  const [showZoneMap, setShowZoneMap] = useState(false);
  const [showTableView, setShowTableView] = useState(false);
  const [activeDungeon, setActiveDungeon] = useState<Dungeon | null>(null);
  const [lootOpenFor, setLootOpenFor] = useState<string | null>(null);
  const [lootKind, setLootKind] = useState<"gold" | "item">("gold");
  const [lootLabel, setLootLabel] = useState("");
  const [lootAmount, setLootAmount] = useState("");
  const [lootAuthorName, setLootAuthorName] = useState(user?.displayName || user?.username || "");
  const [lootStatus, setLootStatus] = useState<"idle" | "saving">("idle");
  const [lootError, setLootError] = useState<string | null>(null);

  const partyMode = mode === "party";
  const selectedWorld = worlds.find((w) => w.id === partyWorldId) ?? null;
  const isOwner = partyMode && !!selectedWorld?.isOwner;
  const canEdit = !partyMode || isOwner;

  useEffect(() => {
    if (!partyMode || !partyWorldId) setLiveEncounter(null);
  }, [partyMode, partyWorldId]);

  const { error: liveConnError } = useWorldLiveChannel(partyMode ? partyWorldId : null, { onEncounter: setLiveEncounter });
  useEffect(() => { if (liveConnError) setLiveError(liveConnError); }, [liveConnError]);

  const activeEncounter: EncounterStateInput = partyMode ? (liveEncounter ?? BLANK_ENCOUNTER) : encounter;

  // Older saved encounters (before conditions/kind/hpVisible/zones existed) won't have these
  // fields, and encounters saved before duration tracking existed have plain strings in
  // conditions rather than { name, expiresAtRound } — normalize both on the way in.
  const sorted = [...activeEncounter.combatants]
    .map((c) => ({
      ...c,
      conditions: (c.conditions ?? []).map((cond): LiveCombatantCondition =>
        typeof cond === "string" ? { name: cond, expiresAtRound: null } : cond
      ),
      kind: c.kind ?? "custom",
      hpVisible: c.hpVisible ?? false,
    }))
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
      const acBonus = await equipmentAcBonusFor(character.equippedItems, character.attunedItems);
      const attacks = parseStatBlockAttacks(character.statBlock.actions);
      addCombatant({
        id: crypto.randomUUID(),
        name: character.name,
        kind: "monster",
        initiative: rollD20() + abilityModifier(character.statBlock.abilityScores.dex),
        maxHp: character.statBlock.hitPointsAverage,
        currentHp: character.statBlock.hitPointsAverage,
        hpStatus: "healthy",
        armorClass: character.statBlock.armorClass + acBonus,
        conditions: [],
        notes: "",
        hpVisible: false,
        xp: character.statBlock.xp,
        equipmentAcBonus: acBonus > 0 ? acBonus : undefined,
        attacks: attacks.length > 0 ? attacks : undefined,
      });
    } else if (type === "playerCharacter") {
      const pc = await api.getPlayerCharacter(result.id);
      const acBonus = await equipmentAcBonusFor(pc.equippedItems, pc.attunedItems);
      addCombatant({
        id: crypto.randomUUID(),
        name: pc.name,
        kind: "playerCharacter",
        initiative: rollD20() + abilityModifier(pc.abilityScores.dex),
        maxHp: pc.maxHp,
        currentHp: pc.maxHp,
        hpStatus: "healthy",
        armorClass: pc.armorClass + acBonus,
        conditions: [],
        notes: "",
        hpVisible: true,
        level: pc.level,
        equipmentAcBonus: acBonus > 0 ? acBonus : undefined,
        playerCharacterId: pc.id,
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

  function toggleCondition(id: string, name: string) {
    applyEncounterUpdate((e) => ({
      ...e,
      combatants: e.combatants.map((c) => {
        if (c.id !== id) return c;
        const conditions = c.conditions ?? [];
        if (conditions.some((cond) => cond.name === name)) {
          return { ...c, conditions: conditions.filter((cond) => cond.name !== name) };
        }
        const rounds = Number(conditionDuration[id]);
        const expiresAtRound = Number.isFinite(rounds) && rounds > 0 ? e.round + rounds : null;
        return { ...c, conditions: [...conditions, { name, expiresAtRound }] };
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

  function openAttackFor(c: LiveCombatant) {
    setAttackOpenFor(c.id);
    const firstTarget = sorted.find((t) => t.id !== c.id);
    setAttackTargetId(firstTarget?.id ?? "");
    selectAttack(c, c.attacks?.[0]?.name ?? "");
    setAttackAdvMode("normal");
    setAttackError(null);
  }

  function selectAttack(c: LiveCombatant, name: string) {
    setAttackChoice(name);
    const found = c.attacks?.find((a) => a.name === name);
    setAttackToHitBonus(String(found?.toHitBonus ?? 0));
    setAttackDamageDice(found?.damageDice ?? "1d6");
    setAttackRollResult(null);
    setAttackDamageResult(null);
    setAttackError(null);
  }

  async function announceAttackRoll(attacker: LiveCombatant, payload: {
    notation: string; results: number[]; modifier: number; total: number; mode?: "adv" | "dis";
  }, label: string) {
    if (!partyMode || !partyWorldId) return;
    try {
      await api.postRollLogEntry({ worldId: partyWorldId, rollerName: attacker.name, hiddenFromParty: false, label, ...payload });
    } catch {
      // Best-effort party announcement — the attack itself already resolved locally either way.
    }
  }

  function rollToHit(attacker: LiveCombatant) {
    const target = sorted.find((t) => t.id === attackTargetId);
    const bonus = Number(attackToHitBonus) || 0;
    const rolls = attackAdvMode === "normal" ? [rollD20()] : [rollD20(), rollD20()];
    const kept = attackAdvMode === "dis" ? Math.min(...rolls) : Math.max(...rolls);
    const total = kept + bonus;
    const hit = target?.armorClass !== undefined ? total >= target.armorClass : null;
    setAttackRollResult({ rolls, total, hit });
    setAttackDamageResult(null);
    if (target) {
      const acNote = target.armorClass !== undefined ? ` (AC ${target.armorClass})` : "";
      const outcome = hit === null ? "" : hit ? " — HIT" : " — MISS";
      announceAttackRoll(attacker, {
        notation: "1d20", results: rolls, modifier: bonus, total, mode: attackAdvMode === "normal" ? undefined : attackAdvMode,
      }, `${attackChoice || "Attack"}: ${attacker.name} vs ${target.name}${acNote}${outcome}`);
    }
  }

  function rollDamage(attacker: LiveCombatant) {
    const target = sorted.find((t) => t.id === attackTargetId);
    if (!target) return;
    const parsed = parseNotation(attackDamageDice);
    if (!parsed) {
      setAttackError(`Can't parse "${attackDamageDice}" — try something like 1d8+3.`);
      return;
    }
    setAttackError(null);
    const results = rollDice(parsed.count, parsed.sides);
    const total = Math.max(0, results.reduce((sum, r) => sum + r, 0) + parsed.modifier);
    setAttackDamageResult({ total });
    adjustHp(target.id, -total);
    announceAttackRoll(attacker, {
      notation: attackDamageDice, results, modifier: parsed.modifier, total,
    }, `${attackChoice || "Attack"} damage: ${attacker.name} vs ${target.name}`);
  }

  function openLootFor(c: LiveCombatant) {
    setLootOpenFor(c.id);
    setLootKind("gold");
    setLootLabel(`Loot from ${c.name}`);
    setLootAmount("");
    setLootError(null);
  }

  async function submitLoot(c: LiveCombatant) {
    const amount = Math.trunc(Number(lootAmount));
    if (!partyWorldId || !amount || amount <= 0) return;
    setLootStatus("saving");
    setLootError(null);
    try {
      await api.postLedgerEntry({
        worldId: partyWorldId,
        kind: lootKind,
        amount,
        label: lootLabel.trim() || (lootKind === "gold" ? `Loot from ${c.name}` : c.name),
        authorName: lootAuthorName.trim() || user!.displayName || user!.username,
      });
      setLootOpenFor(null);
      setLootAmount("");
    } catch (e) {
      setLootError((e as Error).message);
    } finally {
      setLootStatus("idle");
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
        <div className="page-title">
          <CombatIcon className="page-title-icon" aria-hidden="true" />
          <h2>Initiative Tracker</h2>
        </div>
        <span className="round-banner mono">Round {activeEncounter.round}</span>
      </div>

      {worlds.length === 0 ? (
        <p className="hint">Create or join a world to run combat with your party.</p>
      ) : (
        <div className="tabs dice-mode-toggle" role="tablist">
          <button role="tab" className={mode === "personal" ? "active" : ""} aria-selected={mode === "personal"} onClick={() => setMode("personal")}>Personal</button>
          <button role="tab" className={partyMode ? "active" : ""} aria-selected={partyMode} onClick={() => setMode("party")}>Party</button>
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

      {canEdit && (
        <>
          <h3 className="section-heading">Combatants</h3>
          <div className="button-row">
            <button className="btn-secondary" aria-expanded={rosterPickType === "character"} onClick={() => { setRosterPickType(rosterPickType === "character" ? null : "character"); setAddingCustom(false); setPickedTable(null); }}>+ Add NPC/Monster</button>
            <button className="btn-secondary" aria-expanded={rosterPickType === "playerCharacter"} onClick={() => { setRosterPickType(rosterPickType === "playerCharacter" ? null : "playerCharacter"); setAddingCustom(false); setPickedTable(null); }}>+ Add PC from Roster</button>
            <button className="btn-secondary" aria-expanded={rosterPickType === "encounterTable"} onClick={() => { setRosterPickType(rosterPickType === "encounterTable" ? null : "encounterTable"); setAddingCustom(false); setPickedTable(null); }}>+ Add from Table</button>
            <button className="btn-secondary" aria-expanded={addingCustom} onClick={() => { setAddingCustom((v) => !v); setRosterPickType(null); setPickedTable(null); }}>+ Add Custom</button>
          </div>
        </>
      )}

      <h3 className="section-heading">Turn &amp; Party</h3>
      <div className="button-row">
        <button className="btn-secondary" aria-expanded={showConditionRules} onClick={() => setShowConditionRules((v) => !v)}>Condition Rules</button>
        {canEdit && sorted.length > 0 && <button className="btn-secondary" onClick={nextTurn}>Next Turn</button>}
        {canEdit && sorted.length > 0 && <button className="btn-secondary" onClick={restAll}>Rest All</button>}
        {canEdit && sorted.length > 0 && <button className="btn-danger" onClick={clearEncounter}>Clear Encounter</button>}
      </div>

      <h3 className="section-heading">Map &amp; Dungeon</h3>
      <div className="button-row">
        <button className="btn-secondary" aria-expanded={showZoneMap} onClick={() => setShowZoneMap((v) => !v)}>{showZoneMap ? "Hide Zone Map" : "Show Zone Map"}</button>
        {isOwner && (
          <>
            <button className="btn-secondary" aria-expanded={showTableView} onClick={() => setShowTableView((v) => !v)}>
              {showTableView ? "Hide Table View" : "Table View"}
            </button>
            <button
              className="btn-secondary"
              onClick={() => window.open(`${window.location.pathname}?present=${partyWorldId}`, "_blank", "noopener,width=1400,height=900")}
            >
              Cast to Table ↗
            </button>
          </>
        )}
      </div>
      {isOwner && (
        <p className="hint">
          <strong>Table View</strong> shows the read-only turn order and map right here — no second window needed.{" "}
          <strong>Cast to Table</strong> opens the same thing in its own window, for a second monitor or TV.
        </p>
      )}

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

      {showTableView && partyMode && partyWorldId && (
        <div className="inline-table-view">
          <PresentationView worldId={partyWorldId} />
        </div>
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
        <EmptyState
          icon={<CombatIcon />}
          heading="No combatants yet"
          hint={canEdit ? "Add from the roster or add a custom entry (e.g. a PC)." : "No combat happening right now."}
        />
      )}

      <ul className="combatant-list">
        {sorted.map((c) => canEdit ? (
          <li key={c.id} className={`combatant-row${c.id === activeId ? " active-turn" : ""}${(c.currentHp ?? 0) <= 0 ? " down" : ""}`}>
            <div className="combatant-main">
              <input
                type="number"
                className="combatant-initiative mono"
                value={c.initiative}
                onChange={(e) => updateCombatant(c.id, { initiative: Number(e.target.value) })}
                aria-label={`${c.name} initiative`}
              />
              <span className="combatant-name">{c.name}</span>
              {c.armorClass !== undefined && (
                <span className="entity-meta">
                  AC {c.armorClass}
                  {!!c.equipmentAcBonus && <span className="item-stat-badge" title={`Includes +${c.equipmentAcBonus} from equipped items`}>+{c.equipmentAcBonus} equipped</span>}
                </span>
              )}
              {sorted.length > 1 && (
                <button
                  className="btn-secondary"
                  aria-expanded={attackOpenFor === c.id}
                  onClick={() => (attackOpenFor === c.id ? setAttackOpenFor(null) : openAttackFor(c))}
                >
                  ⚔ Attack
                </button>
              )}
              <button className="btn-danger" onClick={() => removeCombatant(c.id)} aria-label={`Remove ${c.name}`}>Remove</button>
            </div>

            {attackOpenFor === c.id && (
              <div className="save-panel attack-panel">
                <label className="field">
                  <span>Target</span>
                  <select value={attackTargetId} onChange={(e) => setAttackTargetId(e.target.value)}>
                    {sorted.filter((t) => t.id !== c.id).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}{t.armorClass !== undefined ? ` (AC ${t.armorClass})` : ""}</option>
                    ))}
                  </select>
                </label>
                {!!c.attacks?.length && (
                  <label className="field">
                    <span>Attack</span>
                    <select value={attackChoice} onChange={(e) => selectAttack(c, e.target.value)}>
                      {c.attacks.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
                      <option value="">Manual attack</option>
                    </select>
                  </label>
                )}
                {(() => {
                  const selected = c.attacks?.find((a) => a.name === attackChoice);
                  return selected?.savingThrow ? (
                    <p className="hint">
                      Also calls for a DC {selected.savingThrow.dc} {selected.savingThrow.ability.toUpperCase()} saving throw — resolve that separately.
                    </p>
                  ) : null;
                })()}
                <label className="field">
                  <span>To-hit bonus</span>
                  <input type="number" value={attackToHitBonus} onChange={(e) => setAttackToHitBonus(e.target.value)} />
                </label>
                <div className="tabs apply-mode-toggle" role="tablist">
                  <button role="tab" className={attackAdvMode === "normal" ? "active" : ""} aria-selected={attackAdvMode === "normal"} onClick={() => setAttackAdvMode("normal")}>Normal</button>
                  <button role="tab" className={attackAdvMode === "adv" ? "active" : ""} aria-selected={attackAdvMode === "adv"} onClick={() => setAttackAdvMode("adv")}>Advantage</button>
                  <button role="tab" className={attackAdvMode === "dis" ? "active" : ""} aria-selected={attackAdvMode === "dis"} onClick={() => setAttackAdvMode("dis")}>Disadvantage</button>
                </div>
                <button className="btn-primary" onClick={() => rollToHit(c)}>Roll to Hit</button>
                {attackRollResult && (
                  <p className="encounter-roll-result" role="status">
                    Rolled [{attackRollResult.rolls.join(", ")}]{attackToHitBonus !== "0" ? ` + ${attackToHitBonus}` : ""} = <strong className="mono">{attackRollResult.total}</strong>
                    {" — "}
                    {attackRollResult.hit === null ? "target has no AC set" : attackRollResult.hit ? <strong>HIT</strong> : <strong>MISS</strong>}
                  </p>
                )}
                {attackRollResult?.hit !== false && (
                  <>
                    <label className="field">
                      <span>Damage dice</span>
                      <input type="text" value={attackDamageDice} onChange={(e) => setAttackDamageDice(e.target.value)} placeholder="e.g. 1d8+3" />
                    </label>
                    {attackError && <p className="error">{attackError}</p>}
                    <button className="btn-primary" onClick={() => rollDamage(c)}>Roll Damage &amp; Apply</button>
                    {attackDamageResult && (
                      <p className="encounter-roll-result" role="status">Applied {attackDamageResult.total} damage.</p>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="combatant-conditions">
              {c.conditions.map((cond) => {
                const expired = cond.expiresAtRound !== null && cond.expiresAtRound < activeEncounter.round;
                return (
                  <span key={cond.name} className={`condition-chip${expired ? " condition-chip-expired" : ""}`}>
                    {cond.name}
                    {cond.expiresAtRound !== null && ` (until round ${cond.expiresAtRound})`}
                    <button onClick={() => toggleCondition(c.id, cond.name)} aria-label={`Remove ${cond.name} from ${c.name}`}>×</button>
                  </span>
                );
              })}
              <button className="btn-secondary condition-toggle" aria-expanded={openConditionsFor === c.id} onClick={() => setOpenConditionsFor(openConditionsFor === c.id ? null : c.id)}>
                + Condition
              </button>
              {openConditionsFor === c.id && (
                <div className="condition-picker">
                  <label className="field condition-duration-field">
                    <span>Duration in rounds (optional)</span>
                    <input
                      type="number"
                      min={1}
                      value={conditionDuration[c.id] ?? ""}
                      onChange={(e) => setConditionDuration((d) => ({ ...d, [c.id]: e.target.value }))}
                      placeholder="indefinite"
                    />
                  </label>
                  {CONDITIONS.map((cond) => (
                    <button
                      key={cond}
                      className={c.conditions.some((x) => x.name === cond) ? "active" : ""}
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

            {(() => {
              const zone = zones.find((z) => z.id === c.zoneId);
              if (!zone?.hazard) return null;
              const hazard = zone.hazard;
              return (
                <div className="button-row">
                  <span>⚠ In hazard zone: {hazard.label}</span>
                  <button className="btn-danger" onClick={() => adjustHp(c.id, -hazard.damage)}>
                    Apply Hazard (-{hazard.damage} hp)
                  </button>
                </div>
              );
            })()}

            <div className="combatant-hp">
              <span className="combatant-hp-value mono">{c.currentHp ?? 0} / {c.maxHp ?? 0} HP</span>
              <HpBar current={c.currentHp ?? 0} max={c.maxHp ?? 0} />
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
              {partyMode && c.kind !== "playerCharacter" && (c.currentHp ?? 0) <= 0 && (
                <button
                  className="btn-secondary"
                  aria-expanded={lootOpenFor === c.id}
                  onClick={() => (lootOpenFor === c.id ? setLootOpenFor(null) : openLootFor(c))}
                >
                  💰 Add Loot
                </button>
              )}
            </div>

            {lootOpenFor === c.id && (
              <div className="save-panel">
                <div className="tabs" role="tablist">
                  <button role="tab" className={lootKind === "gold" ? "active" : ""} aria-selected={lootKind === "gold"} onClick={() => { setLootKind("gold"); setLootLabel(`Loot from ${c.name}`); }}>Gold</button>
                  <button role="tab" className={lootKind === "item" ? "active" : ""} aria-selected={lootKind === "item"} onClick={() => { setLootKind("item"); setLootLabel(""); }}>Item</button>
                </div>
                <label className="field">
                  <span>{lootKind === "gold" ? "Reason" : "Item name"}</span>
                  <input type="text" value={lootLabel} onChange={(e) => setLootLabel(e.target.value)} />
                </label>
                <label className="field">
                  <span>{lootKind === "gold" ? "Gold amount" : "Quantity"}</span>
                  <input type="number" min={1} value={lootAmount} onChange={(e) => setLootAmount(e.target.value)} />
                </label>
                <label className="field">
                  <span>Your name</span>
                  <input type="text" value={lootAuthorName} onChange={(e) => setLootAuthorName(e.target.value)} placeholder={user?.displayName || user?.username} />
                </label>
                {lootError && <p className="error">{lootError}</p>}
                <button className="btn-primary" onClick={() => submitLoot(c)} disabled={lootStatus === "saving"}>
                  {lootStatus === "saving" ? "Adding…" : "Add to Ledger"}
                </button>
              </div>
            )}
          </li>
        ) : (
          <li key={c.id} className={`combatant-row read-only${c.id === activeId ? " active-turn" : ""}${c.hpStatus === "down" ? " down" : ""}`}>
            <div className="combatant-main">
              <span className="combatant-initiative-readonly mono">{c.initiative}</span>
              <span className="combatant-name">{c.name}</span>
              {c.armorClass !== undefined && (
                <span className="entity-meta">
                  AC {c.armorClass}
                  {!!c.equipmentAcBonus && <span className="item-stat-badge" title={`Includes +${c.equipmentAcBonus} from equipped items`}>+{c.equipmentAcBonus} equipped</span>}
                </span>
              )}
            </div>

            {c.conditions.length > 0 && (
              <div className="combatant-conditions">
                {c.conditions.map((cond) => (
                  <span key={cond.name} className="condition-chip condition-chip-readonly">{cond.name}</span>
                ))}
              </div>
            )}

            <div className="combatant-hp">
              {c.currentHp !== undefined && c.maxHp !== undefined ? (
                <>
                  <span className="combatant-hp-value mono">{c.currentHp} / {c.maxHp} HP</span>
                  <HpBar current={c.currentHp} max={c.maxHp} />
                </>
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
