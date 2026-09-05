import { useEffect, useMemo, useRef, useState } from "react";
import type { LiveCombatant, LiveCombatantCondition, EncounterZone, Dungeon, DungeonRoomState, DifficultyRating, SpellDef, TriggerRule, TriggerMatch } from "@spark/shared";
import { computeConcentrationDc, isHostilePair, leftReach, CONDITIONS_COMPENDIUM, getRuleset, applyHouseRules, evaluateTriggers, analyzeEncounterBalance } from "@spark/shared";
import { api, type WorldSummary } from "../api";
import { useAuth } from "../AuthContext";
import { ZoneMap } from "./ZoneMap";
import { GridMap } from "./GridMap";
import { useEncounterState, BLANK_ENCOUNTER } from "../useEncounterState";
import { CombatIcon } from "./icons";
import { EmptyState } from "./EmptyState";
import { PresentationView } from "../pages/PresentationView";
import { AddCombatantPanel } from "./AddCombatantPanel";
import { CombatantRowReadOnly } from "./CombatantRowReadOnly";
import { CombatantRow, type CombatantActions, type CombatantPanel } from "./CombatantRow";
import { RulesLinkedText } from "./RulesLinkedText";
import { ResizeDivider, useResizableColumn } from "./ResizeDivider";
import type { CSSProperties } from "react";

const CONDITIONS = CONDITIONS_COMPENDIUM.map((c) => c.name);
const CONDITION_RULES: Record<string, string> = Object.fromEntries(
  CONDITIONS_COMPENDIUM.map((c) => [c.name, c.description]),
);

const DIFFICULTY_LABELS: Record<DifficultyRating, string> = {
  trivial: "Trivial", easy: "Easy", medium: "Medium", hard: "Hard", deadly: "Deadly",
};

export function InitiativeTracker({
  worlds, partyWorldId, setPartyWorldId, onMapActiveChange,
}: {
  worlds: WorldSummary[];
  partyWorldId: string;
  setPartyWorldId: (id: string) => void;
  // Lets the page collapse its own tools column when a map opens, so the
  // map isn't left competing for width with a fixed-width sidebar it
  // doesn't need — same "lift shared state to the page" pattern already
  // used for partyWorldId/setPartyWorldId above.
  onMapActiveChange?: (active: boolean) => void;
}) {
  const { user } = useAuth();
  const [mode, setMode] = useState<"personal" | "party">("personal");
  const { width: railWidth, dividerProps: railDividerProps } = useResizableColumn("spark-tracker-map-width", 320, 280, 480, -1);

  const [showConditionRules, setShowConditionRules] = useState(false);
  const [spells, setSpells] = useState<SpellDef[]>([]);
  const [showZoneMap, setShowZoneMap] = useState(false);
  const [showGridMap, setShowGridMap] = useState(false);
  const [showTableView, setShowTableView] = useState(false);
  const [activeDungeon, setActiveDungeon] = useState<Dungeon | null>(null);
  // Which combatant has which panel expanded — one piece of state for the
  // whole list, replacing six parallel `xOpenFor` ids. Adding a seventh
  // panel is now a name in CombatantPanel rather than another useState,
  // and only one panel is open at a time, which is what the narrow rail
  // beside an open battle map has room for anyway.
  const [openPanel, setOpenPanel] = useState<{ combatantId: string; panel: CombatantPanel } | null>(null);
  const [concentrationPrompt, setConcentrationPrompt] = useState<{ id: string; name: string; spell: string; dc: number } | null>(null);
  const [templateTargetIds, setTemplateTargetIds] = useState<string[]>([]);
  const [templateDamage, setTemplateDamage] = useState("");
  const [templateCondition, setTemplateCondition] = useState("");

  useEffect(() => { if (!showGridMap) setTemplateTargetIds([]); }, [showGridMap]);
  useEffect(() => { api.getCompendium().then((c) => setSpells(c.data.spells)).catch(() => {}); }, []);
  const spellsById = useMemo(() => new Map(spells.map((s) => [s.id, s])), [spells]);

  const [opportunityPrompt, setOpportunityPrompt] = useState<{ moverName: string; leftName: string } | null>(null);

  const partyMode = mode === "party";
  const selectedWorld = worlds.find((w) => w.id === partyWorldId) ?? null;
  const isOwner = partyMode && !!selectedWorld?.isOwner;
  const canEdit = !partyMode || isOwner;

  // Where the encounter lives, and how a write to it reaches the table —
  // localStorage in personal mode, the world's shared live state in party
  // mode. See useEncounterState; nothing below needs to know which.
  const { activeEncounter, applyEncounterUpdate, applyServerEncounter, liveError } =
    useEncounterState({ partyMode, partyWorldId, isOwner });

  // Exits off the room the party is standing in that the DM has put on an
  // edge of its battle map. Empty outside a dungeon, or before any exit has
  // been given an edge — the zone view's Move Party button is unaffected
  // either way.
  const gridExits = useMemo(() => {
    if (!activeDungeon || !activeEncounter.activeDungeonRoomId) return [];
    const room = activeDungeon.rooms.find((r) => r.id === activeEncounter.activeDungeonRoomId);
    if (!room) return [];
    return room.exits
      .filter((e) => !!e.mapEdge)
      .map((e) => ({
        toRoomId: e.toRoomId,
        toRoomName: activeDungeon.rooms.find((r) => r.id === e.toRoomId)?.name ?? "another room",
        label: e.label,
        mapEdge: e.mapEdge!,
      }));
  }, [activeDungeon, activeEncounter.activeDungeonRoomId]);


  // Older saved encounters (before conditions/kind/hpVisible/notes/zones existed) won't have
  // these fields, and encounters saved before duration tracking existed have plain strings in
  // conditions rather than { name, expiresAtRound } — normalize both on the way in. Notes in
  // particular has to default here (not just at the type level): the combatant-notes <input>
  // below binds it directly, and an undefined value would make that a briefly-uncontrolled
  // input for any combatant carried over from before this field existed.
  //
  // Memoized because it is the input to nearly everything downstream — the
  // encounter difficulty readout, the balance analysis, the trigger
  // evaluation, and the grid's own reachability fill. Rebuilding it per
  // render made all of those run again on every keystroke in an HP box and
  // on every 80ms token-drag tick arriving over the live channel.
  const sorted = useMemo(() => [...activeEncounter.combatants]
    .map((c) => ({
      ...c,
      conditions: (c.conditions ?? []).map((cond): LiveCombatantCondition =>
        typeof cond === "string" ? { name: cond, expiresAtRound: null } : cond
      ),
      kind: c.kind ?? "custom",
      hpVisible: c.hpVisible ?? false,
      notes: c.notes ?? "",
    }))
    .sort((a, b) => b.initiative - a.initiative), [activeEncounter.combatants]);
  const activeId = sorted.length > 0 ? sorted[activeEncounter.turnIndex % sorted.length]?.id : null;
  const houseRules = selectedWorld?.houseRules;
  const difficulty = useMemo(
    () => applyHouseRules(getRuleset(), houseRules ?? {}).computeEncounterDifficulty(sorted),
    [sorted, houseRules],
  );
  const balance = useMemo(() => analyzeEncounterBalance(sorted), [sorted]);
  const mapActive = showZoneMap || showGridMap;

  // Refetched whenever the selected world changes — trigger rules are
  // authored ahead of time on World Overview (TriggerRulesPanel), not
  // edited mid-combat, so a one-shot fetch here (same as the compendium
  // spells fetch above) is enough; no live-channel wiring needed.
  const [triggerRules, setTriggerRules] = useState<TriggerRule[]>([]);
  useEffect(() => {
    if (!partyWorldId) { setTriggerRules([]); return; }
    api.listTriggerRules(partyWorldId).then(setTriggerRules).catch(() => {});
  }, [partyWorldId]);

  function triggerMatchKey(m: TriggerMatch): string {
    return `${m.rule.id}:${m.combatantId ?? "encounter"}`;
  }
  const triggerMatches = useMemo(
    () => evaluateTriggers(triggerRules, sorted, activeEncounter.round),
    [triggerRules, sorted, activeEncounter.round]
  );
  // A match a DM dismissed stays hidden only while it keeps matching —
  // once the underlying condition stops being true (HP recovers, the
  // condition is cleared) and later becomes true again, it's a fresh
  // match and reminds again, same as every other reminder banner here
  // never needing a persisted "seen" flag.
  const [dismissedTriggerKeys, setDismissedTriggerKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    const currentKeys = new Set(triggerMatches.map(triggerMatchKey));
    setDismissedTriggerKeys((prev) => {
      const next = new Set([...prev].filter((k) => currentKeys.has(k)));
      return next.size === prev.size ? prev : next;
    });
  }, [triggerMatches]);
  const visibleTriggerMatches = triggerMatches.filter((m) => !dismissedTriggerKeys.has(triggerMatchKey(m)));
  const [triggerChatStatus, setTriggerChatStatus] = useState<Record<string, "sending" | "sent">>({});

  async function postTriggerToChat(m: TriggerMatch) {
    if (!partyWorldId) return;
    const key = triggerMatchKey(m);
    setTriggerChatStatus((prev) => ({ ...prev, [key]: "sending" }));
    try {
      await api.postChatMessage({ worldId: partyWorldId, text: m.rule.message });
      setTriggerChatStatus((prev) => ({ ...prev, [key]: "sent" }));
    } catch {
      setTriggerChatStatus((prev) => { const next = { ...prev }; delete next[key]; return next; });
    }
  }

  useEffect(() => {
    onMapActiveChange?.(mapActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapActive]);
  const zones = activeEncounter.zones ?? [];
  const zoneEffects = activeEncounter.zoneEffects ?? [];

  // Detects damage to a concentrating combatant regardless of which control
  // applied it (this tracker's own Damage/Heal buttons, a hazard, an
  // auto-applied attack roll, or another party member's "Apply to Combat"
  // in DiceRoller reaching the same encounter over the live channel) by
  // diffing currentHp against the last render's snapshot, rather than
  // instrumenting every call site that can reduce HP.
  const prevHpRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const prevHp = prevHpRef.current;
    const nextHp = new Map<string, number>();
    for (const c of sorted) {
      const currentHp = c.currentHp ?? 0;
      const priorHp = prevHp.get(c.id);
      if (canEdit && c.concentratingOn && priorHp !== undefined && currentHp < priorHp) {
        if (currentHp <= 0) {
          // Concentration ends automatically at 0 HP — no save to prompt.
          updateCombatant(c.id, { concentratingOn: undefined });
          setConcentrationPrompt((p) => (p?.id === c.id ? null : p));
        } else {
          setConcentrationPrompt({ id: c.id, name: c.name, spell: c.concentratingOn, dc: computeConcentrationDc(priorHp - currentHp) });
        }
      }
      nextHp.set(c.id, currentHp);
    }
    prevHpRef.current = nextHp;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted.map((c) => `${c.id}:${c.currentHp ?? 0}:${c.concentratingOn ?? ""}`).join("|"), canEdit]);

  // Same diff-against-last-render approach as the concentration check above —
  // catches a move regardless of whether it came from this tracker's own
  // grid drag or another party member's move arriving over the live
  // channel. Reach is approximated as grid adjacency (see leftReach); this
  // is a reminder for the DM to prompt a player, not an enforced rule, so
  // it doesn't need to be exact.
  const prevGridPosRef = useRef<Map<string, { x: number; y: number; kind: string }>>(new Map());
  useEffect(() => {
    const prevPos = prevGridPosRef.current;
    const nextPos = new Map<string, { x: number; y: number; kind: string }>();
    const placed = sorted.filter((c) => c.gridX !== undefined && c.gridY !== undefined);
    for (const c of placed) nextPos.set(c.id, { x: c.gridX!, y: c.gridY!, kind: c.kind ?? "custom" });

    if (canEdit) {
      for (const c of placed) {
        const before = prevPos.get(c.id);
        if (!before || (before.x === c.gridX && before.y === c.gridY)) continue;
        for (const other of placed) {
          if (other.id === c.id || !isHostilePair(c, other)) continue;
          if (leftReach(before, { x: c.gridX!, y: c.gridY! }, other.gridX!, other.gridY!)) {
            setOpportunityPrompt({ moverName: c.name, leftName: other.name });
            break;
          }
        }
      }
    }
    prevGridPosRef.current = nextPos;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted.map((c) => `${c.id}:${c.gridX ?? ""}:${c.gridY ?? ""}:${c.kind ?? ""}`).join("|"), canEdit]);

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

  function addCombatant(c: LiveCombatant) {
    applyEncounterUpdate((e) => ({ ...e, combatants: [...e.combatants, c] }));
  }

  function updateCombatant(id: string, patch: Partial<LiveCombatant>) {
    applyEncounterUpdate((e) => ({ ...e, combatants: e.combatants.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  }

  function toggleCondition(id: string, name: string, durationRounds: number | null) {
    applyEncounterUpdate((e) => ({
      ...e,
      combatants: e.combatants.map((c) => {
        if (c.id !== id) return c;
        const conditions = c.conditions ?? [];
        if (conditions.some((cond) => cond.name === name)) {
          return { ...c, conditions: conditions.filter((cond) => cond.name !== name) };
        }
        return { ...c, conditions: [...conditions, { name, expiresAtRound: durationRounds === null ? null : e.round + durationRounds }] };
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


  function applyDamageToTemplateTargets() {
    const amount = Number(templateDamage);
    if (!templateDamage || Number.isNaN(amount) || amount <= 0) return;
    applyEncounterUpdate((e) => ({
      ...e,
      combatants: e.combatants.map((c) =>
        templateTargetIds.includes(c.id)
          ? { ...c, currentHp: Math.max(0, Math.min(c.maxHp ?? 0, (c.currentHp ?? 0) - amount)) }
          : c
      ),
    }));
    setTemplateDamage("");
  }

  function applyConditionToTemplateTargets() {
    if (!templateCondition) return;
    applyEncounterUpdate((e) => ({
      ...e,
      combatants: e.combatants.map((c) => {
        if (!templateTargetIds.includes(c.id) || c.conditions.some((cond) => cond.name === templateCondition)) return c;
        return { ...c, conditions: [...c.conditions, { name: templateCondition, expiresAtRound: null }] };
      }),
    }));
  }

  function removeCombatant(id: string) {
    applyEncounterUpdate((e) => ({ ...e, combatants: e.combatants.filter((c) => c.id !== id) }));
  }

  function nextTurn() {
    applyEncounterUpdate((e) => {
      const count = e.combatants.length;
      if (count === 0) return e;
      const next = e.turnIndex + 1;
      const wrapped = next >= count;
      const newIndex = wrapped ? 0 : next;
      // Legendary actions refill at the start of the creature's own turn,
      // not on a timer — the "sorted by initiative" list here has to match
      // the one `sorted`/`activeId` above are built from, since turnIndex
      // is an index into that order, not into e.combatants directly.
      const turnOrder = [...e.combatants].sort((a, b) => b.initiative - a.initiative);
      const newActiveId = turnOrder[newIndex % turnOrder.length]?.id;
      const combatants = e.combatants.map((c) =>
        c.id === newActiveId && c.legendaryActionsMax !== undefined
          ? { ...c, legendaryActionsRemaining: c.legendaryActionsMax }
          : c
      );
      return wrapped ? { ...e, combatants, turnIndex: 0, round: e.round + 1 } : { ...e, combatants, turnIndex: next };
    });
  }

  function spendLegendaryAction(id: string, cost: number) {
    applyEncounterUpdate((e) => ({
      ...e,
      combatants: e.combatants.map((c) =>
        c.id === id ? { ...c, legendaryActionsRemaining: Math.max(0, (c.legendaryActionsRemaining ?? 0) - cost) } : c
      ),
    }));
  }

  function triggerLairAction(id: string) {
    applyEncounterUpdate((e) => ({
      ...e,
      combatants: e.combatants.map((c) => (c.id === id ? { ...c, lairActionUsedRound: e.round } : c)),
    }));
  }

  function clearEncounter() {
    if (!confirm("Clear the current encounter? This cannot be undone.")) return;
    applyEncounterUpdate(() => BLANK_ENCOUNTER);
  }

  // Full HP restore models a long rest — refilling spellSlots to max
  // alongside it matches that same posture (this app doesn't distinguish
  // short vs. long rest at the encounter level, so Rest is the one
  // "everything's back" action, same simplification restCombatant/restAll
  // already made for HP and conditions).
  function refillSpellSlots(c: LiveCombatant): LiveCombatant {
    return c.spellSlots ? { ...c, spellSlots: c.spellSlots.map((s) => ({ ...s, current: s.max })) } : c;
  }

  function restCombatant(id: string) {
    applyEncounterUpdate((e) => ({
      ...e,
      combatants: e.combatants.map((c) => (c.id === id ? refillSpellSlots({ ...c, currentHp: c.maxHp ?? 0, conditions: [] }) : c)),
    }));
  }

  function restAll() {
    if (!confirm("Rest the whole party? Everyone's HP will be restored to max and all conditions cleared.")) return;
    applyEncounterUpdate((e) => ({
      ...e,
      combatants: e.combatants.map((c) => refillSpellSlots({ ...c, currentHp: c.maxHp ?? 0, conditions: [] })),
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
      applyServerEncounter(partyWorldId, api.moveCombatantZone(partyWorldId, combatantId, zoneId));
    }
  }






  // Announces a roll into the party's shared roll log. Named for the attack
  // flow it started in, but the spellcasting handlers below use it too —
  // which is why it stayed here when the attack panel moved into its own
  // component (AttackPanel keeps its own copy for its own rolls).
  async function announceAttackRoll(attacker: LiveCombatant, payload: {
    notation: string; results: number[]; modifier: number; total: number; mode?: "adv" | "dis";
  }, label: string) {
    if (!partyMode || !partyWorldId) return;
    try {
      await api.postRollLogEntry({ worldId: partyWorldId, rollerName: attacker.name, hiddenFromParty: false, label, ...payload });
    } catch {
      // Best-effort party announcement — the roll itself already resolved locally either way.
    }
  }



  // The commitment point of a cast: consumes the caster's matching-level
  // spell slot (cantrips are level 0 and consume nothing) and sets
  // concentration, exactly once per Cast panel session (guarded by
  // castResolved) regardless of which roll — attack, save, or damage —
  // happens to fire first for this spell's effect shape.
  // Spends a levelled spell's slot and sets concentration. CastPanel owns
  // the "only once per cast" guard and calls this on whichever roll
  // resolves the cast first.
  // Applies a failed-save condition from a spell. Lives here rather than in
  // CastPanel because it mutates the shared encounter, which the tracker
  // owns and syncs to the party.
  function applyCastCondition(targetId: string, conditionName: string) {
    applyEncounterUpdate((e) => ({
      ...e,
      combatants: e.combatants.map((c) => {
        if (c.id !== targetId || c.conditions.some((cond) => cond.name === conditionName)) return c;
        return { ...c, conditions: [...c.conditions, { name: conditionName, expiresAtRound: null }] };
      }),
    }));
  }

  function commitCast(caster: LiveCombatant, spellId: string) {
    const spell = spellsById.get(spellId);
    if (!spell) return;
    if (spell.level > 0) {
      applyEncounterUpdate((e) => ({
        ...e,
        combatants: e.combatants.map((c) => {
          if (c.id !== caster.id || !c.spellSlots) return c;
          let spent = false;
          return {
            ...c,
            spellSlots: c.spellSlots.map((s) => {
              if (!spent && s.level === spell.level && s.current > 0) { spent = true; return { ...s, current: s.current - 1 }; }
              return s;
            }),
          };
        }),
      }));
    }
    if (spell.concentration) updateCombatant(caster.id, { concentratingOn: spell.name });
  }



  // Handles every damage-kind spell's payoff: a single-target auto-hit
  // (no attack roll, no save — e.g. Magic Missile), the damage step after
  // a successful/missed attack roll, the damage step after a resolved
  // save (full on a fail, halved or zeroed on a success per the spell's
  // halfOnSuccess flag), and an area spell — which rolls once and prefills
  // the existing "In Template" damage input (Combat Depth Phase B) rather
  // than applying anything itself, since that's already the batch-apply
  // path for whoever the grid says is standing in the placed template.





  function loadZoneMapTemplate(templateZones: EncounterZone[]) {
    const idMap = new Map<string, string>(templateZones.map((z) => [z.id, crypto.randomUUID()]));
    const remapped: EncounterZone[] = templateZones.map((z) => ({
      ...z,
      id: idMap.get(z.id)!,
      connections: z.connections.map((c) => idMap.get(c)).filter((c): c is string => !!c),
    }));
    applyEncounterUpdate((e) => ({ ...e, zones: [...(e.zones ?? []), ...remapped] }));
  }

  const DEFAULT_ROOM_STATE: DungeonRoomState = { cleared: false, alerted: false, disarmedHazardZoneIds: [] };

  async function updateRoomState(dungeonId: string, roomId: string, updater: (s: DungeonRoomState) => DungeonRoomState) {
    const dungeon = await api.getDungeon(dungeonId);
    const rooms = dungeon.rooms.map((r) => (r.id === roomId ? { ...r, state: updater(r.state ?? DEFAULT_ROOM_STATE) } : r));
    const updated = await api.updateDungeon(dungeonId, { rooms });
    setActiveDungeon(updated);
    return updated;
  }

  // Room-level dungeon memory: called right before switching away from
  // whatever room is currently active (either into a different room or
  // out of the dungeon entirely) so its state survives the visit. Cleared
  // is recomputed from the live encounter's remaining hostiles every time
  // — a room can also un-clear if the DM adds fresh monsters and leaves
  // before finishing them off. Disarmed hazards are found by diffing the
  // live zones (which started as a copy of the room's template zones)
  // against the template itself: a zone that had a hazard in the
  // template but doesn't anymore in the live encounter was disarmed.
  async function persistActiveRoomLeaveState() {
    const dungeonId = activeEncounter.activeDungeonId;
    const roomId = activeEncounter.activeDungeonRoomId;
    if (!dungeonId || !roomId || !activeDungeon) return;
    const room = activeDungeon.rooms.find((r) => r.id === roomId);
    if (!room) return;
    const template = await api.getZoneMapTemplate(room.templateId).catch(() => null);
    const liveMonstersAlive = activeEncounter.combatants.some((c) => c.kind === "monster" && (c.currentHp ?? 0) > 0);
    const newlyDisarmed = template
      ? template.zones
          .filter((tz) => tz.hazard)
          .map((tz) => tz.id)
          .filter((zoneId) => {
            const liveZone = activeEncounter.zones.find((z) => z.id === zoneId);
            return !!liveZone && !liveZone.hazard;
          })
      : [];
    await updateRoomState(dungeonId, roomId, (s) => ({
      cleared: !liveMonstersAlive,
      alerted: s.alerted,
      lastVisitedDay: selectedWorld?.currentDay ?? s.lastVisitedDay,
      disarmedHazardZoneIds: Array.from(new Set([...s.disarmedHazardZoneIds, ...newlyDisarmed])),
    }));
  }

  async function loadDungeonRoom(dungeonId: string, roomId: string) {
    await persistActiveRoomLeaveState();
    const dungeon = await api.getDungeon(dungeonId);
    const room = dungeon.rooms.find((r) => r.id === roomId);
    if (!room) return;
    const template = await api.getZoneMapTemplate(room.templateId);
    // A trap this room remembers being disarmed stays disarmed on reload.
    const disarmed = new Set(room.state?.disarmedHazardZoneIds ?? []);
    const zones = template.zones.map((z) => (disarmed.has(z.id) && z.hazard ? { ...z, hazard: undefined } : z));
    applyEncounterUpdate((e) => ({
      ...e,
      zones,
      zoneEffects: [],
      activeDungeonId: dungeonId,
      activeDungeonRoomId: roomId,
      // Coexists with the zone load above rather than replacing it — a
      // room's assigned battle map (set in DungeonEditor) auto-loads the
      // same way its zone template does, the moment the party enters.
      activeBattleMapId: room.battleMapId,
    }));
    setActiveDungeon(dungeon);
  }

  async function leaveDungeon() {
    await persistActiveRoomLeaveState();
    applyEncounterUpdate((e) => ({ ...e, activeDungeonId: undefined, activeDungeonRoomId: undefined }));
    setActiveDungeon(null);
  }

  // Distinct from Remove: a fled monster is still out there and may have
  // warned the rest of the dungeon, so it marks the room alerted (sticky)
  // rather than just disappearing from the encounter.
  async function fleeCombatant(id: string) {
    removeCombatant(id);
    const dungeonId = activeEncounter.activeDungeonId;
    const roomId = activeEncounter.activeDungeonRoomId;
    if (dungeonId && roomId) {
      await updateRoomState(dungeonId, roomId, (s) => ({ ...s, alerted: true }));
    }
  }

  function loadBattleMap(mapId: string) {
    applyEncounterUpdate((e) => ({ ...e, activeBattleMapId: mapId }));
  }

  function leaveBattleMap() {
    applyEncounterUpdate((e) => ({
      ...e,
      activeBattleMapId: undefined,
      combatants: e.combatants.map((c) => ({ ...c, gridX: undefined, gridY: undefined })),
    }));
  }

  function moveCombatantOnGrid(combatantId: string, gridX: number, gridY: number) {
    if (canEdit) {
      applyEncounterUpdate((e) => ({ ...e, combatants: e.combatants.map((c) => (c.id === combatantId ? { ...c, gridX, gridY } : c)) }));
    } else if (partyMode && partyWorldId) {
      applyServerEncounter(partyWorldId, api.moveCombatantGrid(partyWorldId, combatantId, gridX, gridY));
    }
  }

  // Ephemeral, unpersisted — the live glide other viewers see mid-drag.
  // Never touches applyEncounterUpdate/the save queue; the real position
  // is still only committed by moveCombatantOnGrid above, on drop.
  function broadcastTokenDrag(combatantId: string, gridX: number, gridY: number) {
    if (partyMode && partyWorldId) {
      api.broadcastTokenPosition(partyWorldId, combatantId, gridX, gridY).catch(() => {});
    }
  }

  // Same canEdit/party split as moveCombatantOnGrid: the DM's toggle is
  // just a local field flip that rides the normal debounced encounter
  // save, while a non-owner has to go through the narrow toggle-door
  // endpoint (it's the one that actually recomputes fog server-side).
  function toggleDoor(x: number, y: number) {
    const key = `${x},${y}`;
    if (canEdit) {
      applyEncounterUpdate((e) => ({
        ...e,
        openDoorCells: (e.openDoorCells ?? []).includes(key)
          ? (e.openDoorCells ?? []).filter((k) => k !== key)
          : [...(e.openDoorCells ?? []), key],
      }));
    } else if (partyMode && partyWorldId) {
      applyServerEncounter(partyWorldId, api.toggleDoor(partyWorldId, x, y));
    }
  }

  // The encounter is the tracker's to own and sync to the party, so a row
  // never writes it — every mutation a row can make arrives as one of
  // these. Bundled rather than passed as a dozen sibling props: the next
  // per-combatant action should be a line in CombatantActions and a line
  // here, not another prop threaded through the list below.
  const combatantActions: CombatantActions = {
    update: updateCombatant,
    remove: removeCombatant,
    toggleCondition,
    adjustHp,
    rest: restCombatant,
    flee: fleeCombatant,
    spendLegendaryAction,
    commitCast,
    applyCastCondition,
    announceRoll: announceAttackRoll,
    areaDamageRolled: (total) => setTemplateDamage(String(total)),
    dismissConcentrationPrompt: () => setConcentrationPrompt(null),
  };

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
          {DIFFICULTY_LABELS[difficulty.rating]} encounter: {difficulty.adjustedXp} XP (adjusted) vs. {difficulty.thresholds.easy}/{difficulty.thresholds.medium}/{difficulty.thresholds.hard}/{difficulty.thresholds.deadly} easy/medium/hard/deadly thresholds
        </p>
      )}

      {canEdit && balance.partyCount > 0 && balance.monsterCount > 0 && (
        <p className={`balance-readout${balance.partyOutnumbered ? " balance-outnumbered" : ""}`}>
          {balance.monsterCount} monster{balance.monsterCount === 1 ? "" : "s"} vs. {balance.partyCount} PC{balance.partyCount === 1 ? "" : "s"}
          {balance.partyOutnumbered && " (party is outnumbered)"}
          {" · "}
          {balance.expectedDamagePerRound > 0
            ? `~${balance.expectedDamagePerRound} expected dmg/round to the party (${balance.roundsUntilPartyDowned} round${balance.roundsUntilPartyDowned === 1 ? "" : "s"} to down the party at that rate)`
            : "no parsed monster attacks to estimate incoming damage"}
          {" · "}
          {balance.monsterTotalHp} total monster HP
        </p>
      )}

      {canEdit && (() => {
        const lairSource = sorted.find((c) => c.lairActionsList && c.lairActionsList.length > 0);
        if (!lairSource) return null;
        const usedThisRound = lairSource.lairActionUsedRound === activeEncounter.round;
        return (
          <div className="save-panel lair-actions-panel">
            <h3 className="section-heading">Lair Actions ({lairSource.name})</h3>
            <ul className="lair-actions-list">
              {lairSource.lairActionsList!.map((a) => (
                <li key={a.name}><strong>{a.name}.</strong> <RulesLinkedText text={a.description} /></li>
              ))}
            </ul>
            <button className="btn-secondary" disabled={usedThisRound} onClick={() => triggerLairAction(lairSource.id)}>
              {usedThisRound ? `Used This Round (${activeEncounter.round})` : `Trigger Lair Action (Round ${activeEncounter.round})`}
            </button>
          </div>
        );
      })()}

      {canEdit && <AddCombatantPanel onAddCombatant={addCombatant} />}

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
        <button className="btn-secondary" aria-expanded={showGridMap} onClick={() => setShowGridMap((v) => !v)}>{showGridMap ? "Hide Battle Grid" : "Show Battle Grid"}</button>
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
          <strong>Table View</strong> shows the read-only turn order and map right here. No second window needed.{" "}
          <strong>Cast to Table</strong> opens the same thing in its own window, for a second monitor or TV.
        </p>
      )}

      {canEdit && activeDungeon && (() => {
        const activeRoom = activeDungeon.rooms.find((r) => r.id === activeEncounter.activeDungeonRoomId);
        return (
          <p className="hint">
            Dungeon: {activeDungeon.name}
            {activeRoom && ` · Room: ${activeRoom.name}`}
            {activeRoom?.state?.cleared && <span className="room-status-badge cleared"> Cleared</span>}
            {activeRoom?.state?.alerted && <span className="room-status-badge alerted"> Alerted</span>}
            {" "}
            <button className="btn-secondary" onClick={leaveDungeon}>Leave Dungeon</button>
          </p>
        );
      })()}

      {canEdit && opportunityPrompt && (
        <div className="button-row opportunity-prompt">
          <span>
            ⚔ {opportunityPrompt.moverName} left {opportunityPrompt.leftName}'s reach. Attack of Opportunity?
          </span>
          <button className="btn-secondary" onClick={() => setOpportunityPrompt(null)}>Dismiss</button>
        </div>
      )}

      {canEdit && visibleTriggerMatches.map((m) => {
        const key = triggerMatchKey(m);
        const chatStatus = triggerChatStatus[key];
        return (
          <div key={key} className="button-row trigger-prompt">
            <span>
              🔔 {m.rule.name}{m.combatantName ? ` (${m.combatantName})` : ""}: {m.rule.message}
            </span>
            {m.rule.announceInChat && (
              <button className="btn-secondary" onClick={() => postTriggerToChat(m)} disabled={chatStatus === "sending" || chatStatus === "sent"}>
                {chatStatus === "sent" ? "Posted" : chatStatus === "sending" ? "Posting…" : "Post to Chat"}
              </button>
            )}
            <button className="btn-secondary" onClick={() => setDismissedTriggerKeys((prev) => new Set(prev).add(key))}>Dismiss</button>
          </div>
        );
      })}

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

      <div
        className={`tracker-body${mapActive ? " map-active" : ""}`}
        style={mapActive ? ({ "--tracker-rail-width": `${railWidth}px` } as CSSProperties) : undefined}
      >
        <div className="tracker-map-region">
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

          {showGridMap && (
            <GridMap
              worldId={partyMode ? partyWorldId : undefined}
              battleMapId={activeEncounter.activeBattleMapId}
              combatants={sorted}
              activeId={activeId}
              canEdit={canEdit}
              exploredCells={activeEncounter.exploredCells}
              visibleCells={activeEncounter.visibleCells}
              openDoorCells={activeEncounter.openDoorCells}
              onLoadBattleMap={loadBattleMap}
              onLeaveBattleMap={leaveBattleMap}
              onMoveCombatant={moveCombatantOnGrid}
              onPlaceCombatant={moveCombatantOnGrid}
              onDragBroadcast={broadcastTokenDrag}
              onTemplateTargetsChange={setTemplateTargetIds}
              onToggleDoor={toggleDoor}
              exits={gridExits}
              onTravel={canEdit && activeDungeon ? (toRoomId) => loadDungeonRoom(activeDungeon.id, toRoomId) : undefined}
            />
          )}

          {canEdit && showGridMap && templateTargetIds.length > 0 && (
            <div className="save-panel template-batch-panel">
              <h3 className="section-heading">In Template ({templateTargetIds.length})</h3>
              <p className="hint">
                {templateTargetIds.map((id) => sorted.find((c) => c.id === id)?.name).filter(Boolean).join(", ")}
              </p>
              <label className="field">
                <span>Damage to apply to all</span>
                <input type="number" min={1} value={templateDamage} onChange={(e) => setTemplateDamage(e.target.value)} />
              </label>
              <button className="btn-danger" onClick={applyDamageToTemplateTargets}>Apply Damage to All</button>
              <label className="field">
                <span>Condition to apply to all</span>
                <select value={templateCondition} onChange={(e) => setTemplateCondition(e.target.value)}>
                  <option value="">Select…</option>
                  {CONDITIONS.map((cond) => <option key={cond} value={cond}>{cond}</option>)}
                </select>
              </label>
              <button className="btn-secondary" onClick={applyConditionToTemplateTargets}>Apply Condition to All</button>
            </div>
          )}

          {showTableView && partyMode && partyWorldId && (
            <div className="inline-table-view">
              <PresentationView worldId={partyWorldId} />
            </div>
          )}
        </div>

        {mapActive && <ResizeDivider {...railDividerProps} ariaLabel="Resize combatant list" />}

        <div className="tracker-editor-rail">
          {sorted.length === 0 && (
            <EmptyState
              icon={<CombatIcon />}
              heading="No combatants yet"
              hint={canEdit ? "Add from the roster or add a custom entry (e.g. a PC)." : "No combat happening right now."}
            />
          )}

          <ul className="combatant-list">
            {sorted.map((c) => canEdit ? (
              <CombatantRow
                key={c.id}
                c={c}
                isActive={c.id === activeId}
                round={activeEncounter.round}
                combatants={sorted}
                spellsById={spellsById}
                partyMode={partyMode}
                partyWorldId={partyWorldId}
                canFlee={!!activeEncounter.activeDungeonId && !!activeEncounter.activeDungeonRoomId}
                onBattleMap={!!activeEncounter.activeBattleMapId}
                hazard={zones.find((z) => z.id === c.zoneId)?.hazard ?? null}
                concentrationPrompt={concentrationPrompt?.id === c.id ? concentrationPrompt : null}
                lootAuthorName={user?.displayName || user?.username || ""}
                openPanel={openPanel?.combatantId === c.id ? openPanel.panel : null}
                onOpenPanel={(panel) => setOpenPanel(panel ? { combatantId: c.id, panel } : null)}
                actions={combatantActions}
              />
            ) : (
              <CombatantRowReadOnly key={c.id} c={c} isActive={c.id === activeId} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
