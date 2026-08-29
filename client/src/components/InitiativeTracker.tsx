import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchResult, LiveCombatant, LiveCombatantCondition, EncounterStateInput, EncounterZone, Dungeon, DungeonRoomState, DifficultyRating, SpellDef, TriggerRule, TriggerMatch } from "@spark/shared";
import { computeConcentrationDc, isHostilePair, leftReach, CONDITIONS_COMPENDIUM, getRuleset, applyHouseRules, SPELL_EFFECTS, evaluateTriggers, analyzeEncounterBalance } from "@spark/shared";
import { api, type WorldSummary } from "../api";
import { useAuth } from "../AuthContext";
import { EntitySearchPicker } from "./EntitySearchPicker";
import { ZoneMap } from "./ZoneMap";
import { GridMap } from "./GridMap";
import { useLocalStorage } from "../useLocalStorage";
import { useWorldLiveChannel } from "../useWorldLiveChannel";
import { CombatIcon } from "./icons";
import { EmptyState } from "./EmptyState";
import { PresentationView } from "../pages/PresentationView";
import { parseNotation, rollDice } from "./DiceRoller";
import { HpBar } from "./HpBar";
import { AddCombatantPanel, rollD20 } from "./AddCombatantPanel";
import { CombatantRowReadOnly } from "./CombatantRowReadOnly";

const LIGHT_PRESETS: { label: string; feet: number }[] = [
  { label: "Candle", feet: 5 },
  { label: "Torch", feet: 20 },
  { label: "Lantern", feet: 30 },
];

const CONDITIONS = CONDITIONS_COMPENDIUM.map((c) => c.name);
const CONDITION_RULES: Record<string, string> = Object.fromEntries(
  CONDITIONS_COMPENDIUM.map((c) => [c.name, c.description]),
);

const BLANK_ENCOUNTER: EncounterStateInput = { combatants: [], round: 1, turnIndex: 0, zones: [], zoneEffects: [] };

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
  const [encounter, setEncounter] = useLocalStorage<EncounterStateInput>("spark-combat-encounter", BLANK_ENCOUNTER);
  const [mode, setMode] = useState<"personal" | "party">("personal");
  const [liveEncounter, setLiveEncounter] = useState<EncounterStateInput | null>(null);
  // Full-encounter saves are fire-and-forget PUTs with no server-side
  // ordering guarantee; two saves issued close together (e.g. a quick
  // "Next Turn" followed by an HP change) could otherwise arrive out of
  // order and let the older one silently overwrite the newer one. Chaining
  // them through this ref forces each save to wait for the previous one to
  // settle before going out, so they always land at the server in the same
  // order they were issued.
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const [liveError, setLiveError] = useState<string | null>(null);

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
  const [spells, setSpells] = useState<SpellDef[]>([]);
  const [castOpenFor, setCastOpenFor] = useState<string | null>(null);
  const [castSpellId, setCastSpellId] = useState("");
  const [castTargetId, setCastTargetId] = useState("");
  const [castSaveBonus, setCastSaveBonus] = useState("0");
  const [castAdvMode, setCastAdvMode] = useState<"normal" | "adv" | "dis">("normal");
  const [castAttackRollResult, setCastAttackRollResult] = useState<{ rolls: number[]; total: number; hit: boolean | null } | null>(null);
  const [castSaveRollResult, setCastSaveRollResult] = useState<{ rolls: number[]; total: number; success: boolean } | null>(null);
  const [castDamageRolled, setCastDamageRolled] = useState<{ total: number } | null>(null);
  const [castResolved, setCastResolved] = useState(false);
  const [castError, setCastError] = useState<string | null>(null);
  const [showZoneMap, setShowZoneMap] = useState(false);
  const [showGridMap, setShowGridMap] = useState(false);
  const [showTableView, setShowTableView] = useState(false);
  const [activeDungeon, setActiveDungeon] = useState<Dungeon | null>(null);
  const [lootOpenFor, setLootOpenFor] = useState<string | null>(null);
  const [lootKind, setLootKind] = useState<"gold" | "item">("gold");
  const [lootLabel, setLootLabel] = useState("");
  const [lootItemId, setLootItemId] = useState<string | null>(null);
  const [lootPickingItem, setLootPickingItem] = useState(false);
  const [lootAmount, setLootAmount] = useState("");
  const [lootAuthorName, setLootAuthorName] = useState(user?.displayName || user?.username || "");
  const [lootStatus, setLootStatus] = useState<"idle" | "saving">("idle");
  const [lootError, setLootError] = useState<string | null>(null);
  const [concentrationOpenFor, setConcentrationOpenFor] = useState<string | null>(null);
  const [concentrationInput, setConcentrationInput] = useState("");
  const [lightOpenFor, setLightOpenFor] = useState<string | null>(null);
  const [lightInput, setLightInput] = useState("");
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

  // moveCombatantToZone/moveCombatantOnGrid below fire an async request and
  // apply whatever comes back with setLiveEncounter — but if the viewer
  // switches worlds (or flips back to Personal mode) before that response
  // lands, applying it unconditionally would stomp the newly-selected
  // world's live state with the old world's data. Read fresh on every
  // render (not just in an effect) so the .then() callback always sees
  // the current values, not the ones closed over when the request fired.
  const liveContextRef = useRef({ partyWorldId, partyMode });
  liveContextRef.current = { partyWorldId, partyMode };

  useEffect(() => {
    if (!partyMode || !partyWorldId) setLiveEncounter(null);
  }, [partyMode, partyWorldId]);

  const { error: liveConnError } = useWorldLiveChannel(partyMode ? partyWorldId : null, {
    onEncounter: setLiveEncounter,
    onTokenMoved: (payload) => {
      setLiveEncounter((e) => e && ({
        ...e,
        combatants: e.combatants.map((c) => (c.id === payload.combatantId ? { ...c, gridX: payload.gridX, gridY: payload.gridY } : c)),
      }));
    },
  });
  useEffect(() => { setLiveError(liveConnError ?? null); }, [liveConnError]);

  // Widened only to surface visibleCells (server-computed, response-only —
  // see Encounter in shared/src/types.ts) for the fog-of-war rendering
  // GridMap does below; every other field here still comes straight from
  // EncounterStateInput, which liveEncounter's actual runtime value (an
  // Encounter, structurally a superset) always satisfies.
  const activeEncounter: EncounterStateInput & { visibleCells?: string[] } = partyMode ? (liveEncounter ?? BLANK_ENCOUNTER) : encounter;

  // Older saved encounters (before conditions/kind/hpVisible/notes/zones existed) won't have
  // these fields, and encounters saved before duration tracking existed have plain strings in
  // conditions rather than { name, expiresAtRound } — normalize both on the way in. Notes in
  // particular has to default here (not just at the type level): the combatant-notes <input>
  // below binds it directly, and an undefined value would make that a briefly-uncontrolled
  // input for any combatant carried over from before this field existed.
  const sorted = [...activeEncounter.combatants]
    .map((c) => ({
      ...c,
      conditions: (c.conditions ?? []).map((cond): LiveCombatantCondition =>
        typeof cond === "string" ? { name: cond, expiresAtRound: null } : cond
      ),
      kind: c.kind ?? "custom",
      hpVisible: c.hpVisible ?? false,
      notes: c.notes ?? "",
    }))
    .sort((a, b) => b.initiative - a.initiative);
  const activeId = sorted.length > 0 ? sorted[activeEncounter.turnIndex % sorted.length]?.id : null;
  const difficulty = applyHouseRules(getRuleset(), selectedWorld?.houseRules ?? {}).computeEncounterDifficulty(sorted);
  const balance = analyzeEncounterBalance(sorted);
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

  function applyEncounterUpdate(updater: (e: EncounterStateInput) => EncounterStateInput) {
    if (partyMode && isOwner && partyWorldId) {
      setLiveEncounter((e) => {
        const next = updater(e ?? BLANK_ENCOUNTER);
        saveQueueRef.current = saveQueueRef.current.then(
          () => api.saveEncounter(partyWorldId, next),
          () => api.saveEncounter(partyWorldId, next),
        ).catch((err) => setLiveError((err as Error).message));
        return next;
      });
    } else {
      setEncounter(updater);
    }
  }

  function addCombatant(c: LiveCombatant) {
    applyEncounterUpdate((e) => ({ ...e, combatants: [...e.combatants, c] }));
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
      const requestWorldId = partyWorldId;
      api.moveCombatantZone(partyWorldId, combatantId, zoneId)
        .then((result) => {
          if (liveContextRef.current.partyWorldId === requestWorldId && liveContextRef.current.partyMode) setLiveEncounter(result);
        })
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
      const outcome = hit === null ? "" : hit ? ": HIT" : ": MISS";
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
      setAttackError(`Can't parse "${attackDamageDice}". Try something like 1d8+3.`);
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

  function openCastFor(c: LiveCombatant) {
    setCastOpenFor(c.id);
    const firstCastable = (c.preparedSpells ?? []).find((id) => SPELL_EFFECTS[id]);
    setCastSpellId(firstCastable ?? "");
    const firstTarget = sorted.find((t) => t.id !== c.id);
    setCastTargetId(firstTarget?.id ?? "");
    setCastSaveBonus("0");
    setCastAdvMode("normal");
    setCastAttackRollResult(null);
    setCastSaveRollResult(null);
    setCastDamageRolled(null);
    setCastResolved(false);
    setCastError(null);
  }

  function selectCastSpell(id: string) {
    setCastSpellId(id);
    setCastAttackRollResult(null);
    setCastSaveRollResult(null);
    setCastDamageRolled(null);
    setCastResolved(false);
    setCastError(null);
  }

  // The commitment point of a cast: consumes the caster's matching-level
  // spell slot (cantrips are level 0 and consume nothing) and sets
  // concentration, exactly once per Cast panel session (guarded by
  // castResolved) regardless of which roll — attack, save, or damage —
  // happens to fire first for this spell's effect shape.
  function commitCast(caster: LiveCombatant, spellId: string) {
    if (castResolved) return;
    setCastResolved(true);
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

  function rollCastAttack(caster: LiveCombatant) {
    const spell = spellsById.get(castSpellId);
    const effect = SPELL_EFFECTS[castSpellId];
    const target = sorted.find((t) => t.id === castTargetId);
    if (!spell || !effect || effect.resolve.kind !== "damage") return;
    commitCast(caster, castSpellId);
    const bonus = caster.spellAttackBonus ?? 0;
    const rolls = castAdvMode === "normal" ? [rollD20()] : [rollD20(), rollD20()];
    const kept = castAdvMode === "dis" ? Math.min(...rolls) : Math.max(...rolls);
    const total = kept + bonus;
    const hit = target?.armorClass !== undefined ? total >= target.armorClass : null;
    setCastAttackRollResult({ rolls, total, hit });
    setCastDamageRolled(null);
    if (target) {
      const acNote = target.armorClass !== undefined ? ` (AC ${target.armorClass})` : "";
      const outcome = hit === null ? "" : hit ? ": HIT" : ": MISS";
      announceAttackRoll(caster, {
        notation: "1d20", results: rolls, modifier: bonus, total, mode: castAdvMode === "normal" ? undefined : castAdvMode,
      }, `${spell.name}: ${caster.name} vs ${target.name}${acNote}${outcome}`);
    }
  }

  function rollCastSave(caster: LiveCombatant) {
    const spell = spellsById.get(castSpellId);
    const effect = SPELL_EFFECTS[castSpellId];
    const target = sorted.find((t) => t.id === castTargetId);
    if (!spell || !effect || !target) return;
    const resolve = effect.resolve;
    const save = resolve.kind === "damage" ? resolve.save : resolve.kind === "condition" ? resolve.save : undefined;
    if (!save) return;
    commitCast(caster, castSpellId);
    const bonus = Number(castSaveBonus) || 0;
    const roll = rollD20();
    const total = roll + bonus;
    const success = caster.spellSaveDc !== undefined && total >= caster.spellSaveDc;
    setCastSaveRollResult({ rolls: [roll], total, success });
    setCastDamageRolled(null);
    const dcNote = caster.spellSaveDc !== undefined ? ` (DC ${caster.spellSaveDc})` : "";
    announceAttackRoll(target, {
      notation: "1d20", results: [roll], modifier: bonus, total,
    }, `${spell.name}${dcNote}: ${target.name}'s ${save.ability.toUpperCase()} save${success ? " — SUCCESS" : " — FAIL"}`);
    if (resolve.kind === "condition" && !success) {
      const conditionName = resolve.condition;
      applyEncounterUpdate((e) => ({
        ...e,
        combatants: e.combatants.map((c) => {
          if (c.id !== target.id || c.conditions.some((cond) => cond.name === conditionName)) return c;
          return { ...c, conditions: [...c.conditions, { name: conditionName, expiresAtRound: null }] };
        }),
      }));
    }
  }

  // Handles every damage-kind spell's payoff: a single-target auto-hit
  // (no attack roll, no save — e.g. Magic Missile), the damage step after
  // a successful/missed attack roll, the damage step after a resolved
  // save (full on a fail, halved or zeroed on a success per the spell's
  // halfOnSuccess flag), and an area spell — which rolls once and prefills
  // the existing "In Template" damage input (Combat Depth Phase B) rather
  // than applying anything itself, since that's already the batch-apply
  // path for whoever the grid says is standing in the placed template.
  function rollCastDamage(caster: LiveCombatant) {
    const spell = spellsById.get(castSpellId);
    const effect = SPELL_EFFECTS[castSpellId];
    if (!spell || !effect || effect.resolve.kind !== "damage") return;
    const resolve = effect.resolve;
    const parsed = parseNotation(resolve.diceExpr);
    if (!parsed) {
      setCastError(`Can't parse "${resolve.diceExpr}".`);
      return;
    }
    setCastError(null);
    const results = rollDice(parsed.count, parsed.sides);
    const rolledTotal = Math.max(0, results.reduce((sum, r) => sum + r, 0) + parsed.modifier);

    if (effect.area) {
      commitCast(caster, castSpellId);
      setCastDamageRolled({ total: rolledTotal });
      setTemplateDamage(String(rolledTotal));
      announceAttackRoll(caster, {
        notation: resolve.diceExpr, results, modifier: parsed.modifier, total: rolledTotal,
      }, `${spell.name} damage (${caster.name}) — apply to everyone in the template below`);
      return;
    }

    const target = sorted.find((t) => t.id === castTargetId);
    if (!target) return;

    let appliedTotal = rolledTotal;
    if (resolve.attackRoll) {
      if (castAttackRollResult?.hit === false) return; // missed — nothing to apply
    } else if (resolve.save) {
      if (!castSaveRollResult) return; // roll the save first
      if (castSaveRollResult.success) appliedTotal = resolve.save.halfOnSuccess ? Math.floor(rolledTotal / 2) : 0;
    } else {
      commitCast(caster, castSpellId); // auto-hit, no prior roll step
    }

    setCastDamageRolled({ total: appliedTotal });
    adjustHp(target.id, -appliedTotal);
    announceAttackRoll(caster, {
      notation: resolve.diceExpr, results, modifier: parsed.modifier, total: rolledTotal,
    }, `${spell.name} damage: ${caster.name} vs ${target.name} — applied ${appliedTotal}`);
  }

  function rollCastHeal(caster: LiveCombatant) {
    const spell = spellsById.get(castSpellId);
    const effect = SPELL_EFFECTS[castSpellId];
    const target = sorted.find((t) => t.id === castTargetId);
    if (!spell || !effect || effect.resolve.kind !== "heal" || !target) return;
    const parsed = parseNotation(effect.resolve.diceExpr);
    if (!parsed) {
      setCastError(`Can't parse "${effect.resolve.diceExpr}".`);
      return;
    }
    setCastError(null);
    commitCast(caster, castSpellId);
    const results = rollDice(parsed.count, parsed.sides);
    const total = Math.max(0, results.reduce((sum, r) => sum + r, 0) + parsed.modifier);
    setCastDamageRolled({ total });
    adjustHp(target.id, total);
    announceAttackRoll(caster, {
      notation: effect.resolve.diceExpr, results, modifier: parsed.modifier, total,
    }, `${spell.name}: ${caster.name} heals ${target.name} for ${total}`);
  }

  function openLootFor(c: LiveCombatant) {
    setLootOpenFor(c.id);
    setLootKind("gold");
    setLootLabel(`Loot from ${c.name}`);
    setLootItemId(null);
    setLootAmount("");
    setLootError(null);
  }

  function pickLootItem(result: SearchResult) {
    setLootLabel(result.name);
    setLootItemId(result.id);
    setLootPickingItem(false);
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
        itemId: lootKind === "item" ? (lootItemId ?? undefined) : undefined,
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
      const requestWorldId = partyWorldId;
      api.moveCombatantGrid(partyWorldId, combatantId, gridX, gridY)
        .then((result) => {
          if (liveContextRef.current.partyWorldId === requestWorldId && liveContextRef.current.partyMode) setLiveEncounter(result);
        })
        .catch((err) => setLiveError((err as Error).message));
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
      const requestWorldId = partyWorldId;
      api.toggleDoor(partyWorldId, x, y)
        .then((result) => {
          if (liveContextRef.current.partyWorldId === requestWorldId && liveContextRef.current.partyMode) setLiveEncounter(result);
        })
        .catch((err) => setLiveError((err as Error).message));
    }
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
                <li key={a.name}><strong>{a.name}.</strong> {a.description}</li>
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

      <div className={`tracker-body${mapActive ? " map-active" : ""}`}>
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
              {c.speedFeet !== undefined && <span className="entity-meta">Speed {c.speedFeet} ft</span>}
              {sorted.length > 1 && (
                <button
                  className="btn-secondary"
                  aria-expanded={attackOpenFor === c.id}
                  onClick={() => (attackOpenFor === c.id ? setAttackOpenFor(null) : openAttackFor(c))}
                >
                  ⚔ Attack
                </button>
              )}
              {c.preparedSpells?.some((id) => SPELL_EFFECTS[id]) && (
                <button
                  className="btn-secondary"
                  aria-expanded={castOpenFor === c.id}
                  onClick={() => (castOpenFor === c.id ? setCastOpenFor(null) : openCastFor(c))}
                >
                  ✨ Cast
                </button>
              )}
              {c.kind === "monster" && activeEncounter.activeDungeonId && activeEncounter.activeDungeonRoomId && (
                <button className="btn-secondary" onClick={() => fleeCombatant(c.id)} aria-label={`${c.name} flees`}>Flee</button>
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
                      Also calls for a DC {selected.savingThrow.dc} {selected.savingThrow.ability.toUpperCase()} saving throw. Resolve that separately.
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
                    {": "}
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

            {castOpenFor === c.id && (
              <div className="save-panel cast-panel">
                <label className="field">
                  <span>Spell</span>
                  <select value={castSpellId} onChange={(e) => selectCastSpell(e.target.value)}>
                    {(c.preparedSpells ?? []).filter((id) => SPELL_EFFECTS[id]).map((id) => {
                      const spell = spellsById.get(id);
                      return <option key={id} value={id}>{spell?.name ?? id}{spell ? ` (${spell.level === 0 ? "Cantrip" : `Lvl ${spell.level}`})` : ""}</option>;
                    })}
                  </select>
                </label>
                {(() => {
                  const spell = spellsById.get(castSpellId);
                  const effect = SPELL_EFFECTS[castSpellId];
                  if (!spell || !effect) return null;
                  const resolve = effect.resolve;
                  const slotsAtLevel = spell.level > 0 ? c.spellSlots?.find((s) => s.level === spell.level) : undefined;
                  const atkBonus = c.spellAttackBonus ?? 0;
                  const save = resolve.kind === "damage" ? resolve.save : resolve.kind === "condition" ? resolve.save : undefined;

                  return (
                    <>
                      {spell.level > 0 && (
                        <p className="hint">Slots: {slotsAtLevel ? `${slotsAtLevel.current}/${slotsAtLevel.max}` : "none"} at level {spell.level}</p>
                      )}

                      {effect.area ? (
                        <>
                          <p className="hint">
                            Area ({effect.area}) — place a matching template on the grid map below, then roll damage here to fill in the amount to apply to everyone caught in it.
                            {resolve.kind === "damage" && resolve.save?.halfOnSuccess && " Half that for anyone who made their save."}
                          </p>
                          <button className="btn-primary" onClick={() => rollCastDamage(c)}>Roll Damage</button>
                        </>
                      ) : (
                        <>
                          <label className="field">
                            <span>Target</span>
                            <select value={castTargetId} onChange={(e) => setCastTargetId(e.target.value)}>
                              {sorted.filter((t) => t.id !== c.id).map((t) => (
                                <option key={t.id} value={t.id}>{t.name}{t.armorClass !== undefined ? ` (AC ${t.armorClass})` : ""}</option>
                              ))}
                            </select>
                          </label>

                          {resolve.kind === "damage" && resolve.attackRoll && (
                            <>
                              <p className="hint">Spell attack bonus: {atkBonus >= 0 ? `+${atkBonus}` : atkBonus}</p>
                              <div className="tabs apply-mode-toggle" role="tablist">
                                <button role="tab" className={castAdvMode === "normal" ? "active" : ""} aria-selected={castAdvMode === "normal"} onClick={() => setCastAdvMode("normal")}>Normal</button>
                                <button role="tab" className={castAdvMode === "adv" ? "active" : ""} aria-selected={castAdvMode === "adv"} onClick={() => setCastAdvMode("adv")}>Advantage</button>
                                <button role="tab" className={castAdvMode === "dis" ? "active" : ""} aria-selected={castAdvMode === "dis"} onClick={() => setCastAdvMode("dis")}>Disadvantage</button>
                              </div>
                              <button className="btn-primary" onClick={() => rollCastAttack(c)}>Roll to Hit</button>
                              {castAttackRollResult && (
                                <p className="encounter-roll-result" role="status">
                                  Rolled [{castAttackRollResult.rolls.join(", ")}] + {atkBonus} = <strong className="mono">{castAttackRollResult.total}</strong>
                                  {": "}
                                  {castAttackRollResult.hit === null ? "target has no AC set" : castAttackRollResult.hit ? <strong>HIT</strong> : <strong>MISS</strong>}
                                </p>
                              )}
                              {castAttackRollResult?.hit !== false && (
                                <button className="btn-primary" onClick={() => rollCastDamage(c)}>Roll Damage &amp; Apply</button>
                              )}
                            </>
                          )}

                          {save && !(resolve.kind === "damage" && resolve.attackRoll) && (
                            <>
                              <p className="hint">Spell save DC {c.spellSaveDc ?? "—"} ({save.ability.toUpperCase()})</p>
                              <label className="field">
                                <span>Target's save bonus</span>
                                <input type="number" value={castSaveBonus} onChange={(e) => setCastSaveBonus(e.target.value)} />
                              </label>
                              <button className="btn-primary" onClick={() => rollCastSave(c)}>Roll Save</button>
                              {castSaveRollResult && (
                                <p className="encounter-roll-result" role="status">
                                  Rolled [{castSaveRollResult.rolls[0]}] + {Number(castSaveBonus) || 0} = <strong className="mono">{castSaveRollResult.total}</strong>
                                  {": "}
                                  {castSaveRollResult.success ? <strong>SUCCESS</strong> : <strong>FAIL</strong>}
                                </p>
                              )}
                              {resolve.kind === "damage" && castSaveRollResult && (
                                <button className="btn-primary" onClick={() => rollCastDamage(c)}>Roll Damage &amp; Apply</button>
                              )}
                            </>
                          )}

                          {resolve.kind === "damage" && !resolve.attackRoll && !resolve.save && (
                            <button className="btn-primary" onClick={() => rollCastDamage(c)}>Roll Damage &amp; Apply</button>
                          )}

                          {resolve.kind === "heal" && (
                            <button className="btn-primary" onClick={() => rollCastHeal(c)}>Roll Healing &amp; Apply</button>
                          )}

                          {castError && <p className="error">{castError}</p>}
                          {castDamageRolled && (
                            <p className="encounter-roll-result" role="status">
                              {resolve.kind === "heal" ? `Healed ${castDamageRolled.total}.` : `Applied ${castDamageRolled.total} damage.`}
                            </p>
                          )}
                        </>
                      )}
                    </>
                  );
                })()}
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

            {concentrationPrompt?.id === c.id && (
              <div className="button-row concentration-prompt">
                <span>
                  🎯 {concentrationPrompt.name} takes damage while concentrating on {concentrationPrompt.spell}. CON save DC {concentrationPrompt.dc} to maintain it.
                </span>
                <button
                  className="btn-danger"
                  onClick={() => { updateCombatant(c.id, { concentratingOn: undefined }); setConcentrationPrompt(null); }}
                >
                  Broke Concentration
                </button>
                <button className="btn-secondary" onClick={() => setConcentrationPrompt(null)}>Kept It</button>
              </div>
            )}

            <div className="combatant-concentration">
              {c.concentratingOn ? (
                <span className="condition-chip concentration-chip">
                  🎯 Concentrating: {c.concentratingOn}
                  <button onClick={() => updateCombatant(c.id, { concentratingOn: undefined })} aria-label={`Clear ${c.name}'s concentration`}>×</button>
                </span>
              ) : concentrationOpenFor === c.id ? (
                <div className="condition-picker">
                  <input
                    type="text"
                    value={concentrationInput}
                    onChange={(e) => setConcentrationInput(e.target.value)}
                    placeholder="Spell name…"
                  />
                  <button
                    className="btn-primary"
                    onClick={() => {
                      if (!concentrationInput.trim()) return;
                      updateCombatant(c.id, { concentratingOn: concentrationInput.trim() });
                      setConcentrationInput("");
                      setConcentrationOpenFor(null);
                    }}
                  >
                    Set
                  </button>
                  <button className="btn-secondary" onClick={() => { setConcentrationOpenFor(null); setConcentrationInput(""); }}>Cancel</button>
                </div>
              ) : (
                <button className="btn-secondary condition-toggle" onClick={() => { setConcentrationOpenFor(c.id); setConcentrationInput(""); }}>
                  + Concentration
                </button>
              )}
            </div>

            {activeEncounter.activeBattleMapId && (
              <div className="combatant-light">
                {c.lightRadiusFeet ? (
                  <span className="condition-chip light-chip">
                    🔥 Light {c.lightRadiusFeet} ft
                    <button onClick={() => updateCombatant(c.id, { lightRadiusFeet: undefined })} aria-label={`Clear ${c.name}'s carried light`}>×</button>
                  </span>
                ) : lightOpenFor === c.id ? (
                  <div className="condition-picker">
                    {LIGHT_PRESETS.map((p) => (
                      <button key={p.label} className="btn-secondary" onClick={() => { updateCombatant(c.id, { lightRadiusFeet: p.feet }); setLightOpenFor(null); }}>
                        {p.label} ({p.feet} ft)
                      </button>
                    ))}
                    <input
                      type="number"
                      min={5}
                      value={lightInput}
                      onChange={(e) => setLightInput(e.target.value)}
                      placeholder="Custom ft"
                    />
                    <button
                      className="btn-primary"
                      onClick={() => {
                        const feet = Number(lightInput);
                        if (!feet || feet <= 0) return;
                        updateCombatant(c.id, { lightRadiusFeet: feet });
                        setLightInput("");
                        setLightOpenFor(null);
                      }}
                    >
                      Set
                    </button>
                    <button className="btn-secondary" onClick={() => { setLightOpenFor(null); setLightInput(""); }}>Cancel</button>
                  </div>
                ) : (
                  <button className="btn-secondary condition-toggle" onClick={() => { setLightOpenFor(c.id); setLightInput(""); }}>
                    + Carried Light
                  </button>
                )}
              </div>
            )}

            {activeEncounter.activeBattleMapId && (
              <label className="condition-toggle">
                <input
                  type="checkbox"
                  checked={!!c.flying}
                  onChange={(e) => updateCombatant(c.id, { flying: e.target.checked })}
                />
                Flying
              </label>
            )}

            {c.legendaryActionsMax !== undefined && (
              <div className="combatant-legendary">
                <span className="legendary-pips" title={`${c.legendaryActionsRemaining ?? 0} of ${c.legendaryActionsMax} legendary actions remaining`}>
                  Legendary: {"⚡".repeat(Math.max(0, c.legendaryActionsRemaining ?? 0))}{"·".repeat(Math.max(0, c.legendaryActionsMax - (c.legendaryActionsRemaining ?? 0)))}
                </span>
                {c.legendaryActionsList?.map((a) => (
                  <button
                    key={a.name}
                    className="btn-secondary"
                    disabled={(c.legendaryActionsRemaining ?? 0) < a.cost}
                    title={a.description}
                    onClick={() => spendLegendaryAction(c.id, a.cost)}
                  >
                    {a.name} ({a.cost})
                  </button>
                ))}
              </div>
            )}

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
                  <button role="tab" className={lootKind === "gold" ? "active" : ""} aria-selected={lootKind === "gold"} onClick={() => { setLootKind("gold"); setLootLabel(`Loot from ${c.name}`); setLootItemId(null); }}>Gold</button>
                  <button role="tab" className={lootKind === "item" ? "active" : ""} aria-selected={lootKind === "item"} onClick={() => { setLootKind("item"); setLootLabel(""); setLootItemId(null); }}>Item</button>
                </div>
                <label className="field">
                  <span>{lootKind === "gold" ? "Reason" : "Item name"}</span>
                  <input type="text" value={lootLabel} onChange={(e) => { setLootLabel(e.target.value); setLootItemId(null); }} />
                </label>
                {lootKind === "item" && (
                  lootPickingItem ? (
                    <div className="save-panel">
                      <EntitySearchPicker type="item" onSelect={pickLootItem} placeholder="Search items…" />
                      <button className="btn-secondary" onClick={() => setLootPickingItem(false)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="btn-secondary" onClick={() => setLootPickingItem(true)}>Pick from Compendium…</button>
                  )
                )}
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
          <CombatantRowReadOnly key={c.id} c={c} isActive={c.id === activeId} />
        ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
