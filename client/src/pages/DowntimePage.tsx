import { useEffect, useState } from "react";
import type { DowntimeActivity, DowntimeActivityType, DowntimeOutcomeActivityType, DowntimeOutcomeDef, EncounterTable, LiveCombatant, EncounterStateInput, SearchResult, Region, PlayerCharacter, Item } from "@spark/shared";
import { DOWNTIME_ACTIVITY_TYPES, DOWNTIME_ACTIVITY_TYPE_LABELS, DOWNTIME_OUTCOME_ACTIVITY_TYPES, computeCraftingCost } from "@spark/shared";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useActiveWorld } from "../ActiveWorldContext";
import { EntitySearchPicker } from "../components/EntitySearchPicker";
import { rollTableIndex } from "../rollTable";
import { zoneDistances } from "../zoneGraph";
import { DowntimeIcon } from "../components/icons";
import { EmptyState } from "../components/EmptyState";

interface TravelCheck {
  id: string;
  day: number;
  roll: string;
  description: string;
  addedToCombat: boolean;
}

export function DowntimePage({
  craftedItemHandoff, onConsumeCraftedItemHandoff,
}: {
  craftedItemHandoff?: { item: Item; worldId: string } | null;
  onConsumeCraftedItemHandoff?: () => void;
}) {
  const { user } = useAuth();
  const { worldId, worlds, refreshWorlds } = useActiveWorld();
  const [viewMode, setViewMode] = useState<"log" | "travel">("log");

  const [activities, setActivities] = useState<DowntimeActivity[]>([]);
  const [characterName, setCharacterName] = useState("");
  const [activityType, setActivityType] = useState<DowntimeActivityType>("training");
  const [description, setDescription] = useState("");
  const [daysSpent, setDaysSpent] = useState("1");
  const [outcome, setOutcome] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  const [craftedItem, setCraftedItem] = useState<Item | null>(null);
  const [pickingCraftedItem, setPickingCraftedItem] = useState(false);

  const [rolledOutcome, setRolledOutcome] = useState<DowntimeOutcomeDef | null>(null);
  const [rollingOutcome, setRollingOutcome] = useState(false);

  const [pickedTable, setPickedTable] = useState<EncounterTable | null>(null);
  const [pickingTable, setPickingTable] = useState(false);
  const [dayCount, setDayCount] = useState(1);
  const [checks, setChecks] = useState<TravelCheck[]>([]);

  const [playerCharacters, setPlayerCharacters] = useState<PlayerCharacter[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [originRegion, setOriginRegion] = useState<Region | null>(null);
  const [destinationRegion, setDestinationRegion] = useState<Region | null>(null);
  const [pickingOrigin, setPickingOrigin] = useState(false);
  const [pickingDestination, setPickingDestination] = useState(false);

  const [lastLoggedDays, setLastLoggedDays] = useState<number | null>(null);
  const [advancingCalendar, setAdvancingCalendar] = useState(false);

  const world = worlds.find((w) => w.id === worldId) ?? null;

  async function advanceCalendar(days: number) {
    if (!worldId || !Number.isInteger(days) || days < 1) return;
    setAdvancingCalendar(true);
    try {
      await api.advanceWorldDay(worldId, days);
      await refreshWorlds();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdvancingCalendar(false);
    }
  }

  function refresh() {
    if (!worldId) {
      setActivities([]);
      setRegions([]);
      setPlayerCharacters([]);
      return;
    }
    api.listDowntimeActivities(worldId).then(setActivities).catch(() => {});
    api.listRegions(worldId).then(setRegions).catch(() => {});
    api.listPlayerCharacters(worldId).then(setPlayerCharacters).catch(() => {});
  }

  useEffect(refresh, [worldId]);

  // A freshly forged item handed off from Item Forge (see App.tsx's
  // sendToDowntimeLog) pre-fills the crafting form exactly as if the DM
  // had picked it here themself, then clears itself so it doesn't
  // re-trigger on remount or a stray worldId change.
  useEffect(() => {
    if (!craftedItemHandoff || craftedItemHandoff.worldId !== worldId) return;
    setActivityType("crafting");
    setCraftedItem(craftedItemHandoff.item);
    setDescription(`Crafting ${craftedItemHandoff.item.name}`);
    onConsumeCraftedItemHandoff?.();
  }, [craftedItemHandoff, worldId]);

  const suggestedDays = (() => {
    if (!originRegion || !destinationRegion) return null;
    const distances = zoneDistances(regions, originRegion.id);
    return distances.get(destinationRegion.id) ?? null;
  })();

  async function pickOriginRegion(result: SearchResult) {
    setPickingOrigin(false);
    setOriginRegion(await api.getRegion(result.id));
  }

  async function pickDestinationRegion(result: SearchResult) {
    setPickingDestination(false);
    setDestinationRegion(await api.getRegion(result.id));
  }

  async function logActivity() {
    if (!worldId || !characterName.trim() || !description.trim()) return;
    const days = Math.max(1, Math.trunc(Number(daysSpent)) || 1);
    const matchedPC = playerCharacters.find((pc) => pc.name.trim().toLowerCase() === characterName.trim().toLowerCase());
    setStatus("saving");
    setError(null);
    try {
      await api.postDowntimeActivity({
        worldId,
        playerCharacterId: matchedPC?.id,
        characterName: characterName.trim(),
        activityType,
        description: description.trim(),
        daysSpent: days,
        outcome: outcome.trim() || undefined,
        craftedItemId: craftedItem?.id,
        outcomeId: rolledOutcome?.id,
      });
      setDescription("");
      setOutcome("");
      setDaysSpent("1");
      setCraftedItem(null);
      setRolledOutcome(null);
      setLastLoggedDays(days);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  function changeActivityType(next: DowntimeActivityType) {
    setActivityType(next);
    setRolledOutcome(null);
  }

  async function rollOutcome() {
    if (!DOWNTIME_OUTCOME_ACTIVITY_TYPES.includes(activityType as DowntimeOutcomeActivityType)) return;
    setRollingOutcome(true);
    setError(null);
    try {
      const result = await api.generateDowntimeOutcome(activityType as DowntimeOutcomeActivityType);
      setRolledOutcome(result);
      setOutcome(result.text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRollingOutcome(false);
    }
  }

  async function pickCraftedItem(result: SearchResult) {
    setPickingCraftedItem(false);
    setCraftedItem(await api.getItem(result.id));
  }

  async function deleteActivity(id: string) {
    try {
      await api.deleteDowntimeActivity(id);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function pickTable(result: SearchResult) {
    setPickingTable(false);
    const table = await api.getEncounterTable(result.id);
    setPickedTable(table);
  }

  function checkForEncounter() {
    if (!pickedTable) return;
    const index = rollTableIndex(pickedTable.entries);
    const entry = pickedTable.entries[index];
    setChecks((c) => [{ id: crypto.randomUUID(), day: dayCount, roll: entry.roll, description: entry.description, addedToCombat: false }, ...c]);
    setDayCount((d) => d + 1);
  }

  async function escalateToCombat(check: TravelCheck) {
    if (!worldId) return;
    const combatant: LiveCombatant = {
      id: crypto.randomUUID(),
      name: check.description,
      kind: "custom",
      initiative: 10,
      maxHp: 10,
      currentHp: 10,
      hpStatus: "healthy",
      conditions: [],
      notes: "",
      hpVisible: false,
    };
    try {
      const encounter = await api.getEncounter(worldId);
      const next: EncounterStateInput = {
        combatants: [...encounter.combatants, combatant],
        round: encounter.round,
        turnIndex: encounter.turnIndex,
        zones: encounter.zones,
        zoneEffects: encounter.zoneEffects,
        activeDungeonId: encounter.activeDungeonId,
        activeDungeonRoomId: encounter.activeDungeonRoomId,
      };
      await api.saveEncounter(worldId, next);
      setChecks((cs) => cs.map((c) => (c.id === check.id ? { ...c, addedToCombat: true } : c)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="page">
      <div className="tabs forge-mode-tabs">
        <button className={viewMode === "log" ? "active" : ""} aria-current={viewMode === "log" ? "true" : undefined} onClick={() => setViewMode("log")}>Downtime Log</button>
        <button className={viewMode === "travel" ? "active" : ""} aria-current={viewMode === "travel" ? "true" : undefined} onClick={() => setViewMode("travel")}>Travel</button>
      </div>

      {!worldId && <p className="hint">Select a world from the header to track downtime or travel.</p>}

      {worldId && viewMode === "log" && (
        <div className="generator-layout">
          <div className="panel">
            <div className="page-title">
              <DowntimeIcon className="page-title-icon" aria-hidden="true" />
              <h2>Log a Downtime Activity</h2>
            </div>
            <p className="hint">A quick record of what each PC did between sessions.</p>

            <label className="field">
              <span>Character name</span>
              <input type="text" value={characterName} onChange={(e) => setCharacterName(e.target.value)} placeholder="e.g. Aria" list="downtime-character-names" />
              <datalist id="downtime-character-names">
                {playerCharacters.map((pc) => <option key={pc.id} value={pc.name} />)}
              </datalist>
            </label>
            <label className="field">
              <span>Activity type</span>
              <select value={activityType} onChange={(e) => changeActivityType(e.target.value as DowntimeActivityType)}>
                {DOWNTIME_ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{DOWNTIME_ACTIVITY_TYPE_LABELS[t]}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Description</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Trained with the local weaponsmith…" />
            </label>
            <label className="field">
              <span>Days spent</span>
              <input type="number" min={1} value={daysSpent} onChange={(e) => setDaysSpent(e.target.value)} />
            </label>
            <label className="field">
              <span>Outcome (optional)</span>
              <input type="text" value={outcome} onChange={(e) => { setOutcome(e.target.value); setRolledOutcome(null); }} placeholder="Gained proficiency, made a contact…" />
            </label>

            {DOWNTIME_OUTCOME_ACTIVITY_TYPES.includes(activityType as DowntimeOutcomeActivityType) && (
              <div className="field">
                <span>Roll an outcome (optional)</span>
                <button className="btn-secondary" onClick={rollOutcome} disabled={rollingOutcome}>
                  {rollingOutcome ? "Rolling…" : rolledOutcome ? "Reroll" : "Roll Outcome"}
                </button>
                {rolledOutcome && (
                  <p className="hint">
                    {rolledOutcome.goldDelta ? (rolledOutcome.goldDelta > 0 ? `+${rolledOutcome.goldDelta} gp to the party ledger. ` : `${rolledOutcome.goldDelta} gp from the party ledger. `) : ""}
                    {rolledOutcome.hpRestorePercent ? `Restores about ${Math.round(rolledOutcome.hpRestorePercent * 100)}% of missing HP if a matching character is picked above. ` : ""}
                    Logging this activity will apply it.
                  </p>
                )}
              </div>
            )}

            {activityType === "crafting" && (
              <div className="field">
                <span>Item being crafted (optional)</span>
                {craftedItem ? (
                  <div className="button-row">
                    <span>
                      {craftedItem.name} · {computeCraftingCost(craftedItem).goldCost} gp,{" "}
                      {computeCraftingCost(craftedItem).daysRequired}d suggested
                    </span>
                    <button className="btn-secondary" onClick={() => setCraftedItem(null)}>Clear</button>
                  </div>
                ) : pickingCraftedItem ? (
                  <div className="save-panel">
                    <EntitySearchPicker type="item" onSelect={pickCraftedItem} placeholder="Search items…" />
                    <button className="btn-secondary" onClick={() => setPickingCraftedItem(false)}>Cancel</button>
                  </div>
                ) : (
                  <button className="btn-secondary" onClick={() => setPickingCraftedItem(true)}>+ Pick Item</button>
                )}
                {craftedItem && (
                  <p className="hint">
                    Logging this will debit {computeCraftingCost(craftedItem).goldCost} gp from the party ledger and credit one {craftedItem.name} to the party inventory.
                  </p>
                )}
              </div>
            )}

            {error && <p className="error">{error}</p>}
            <button className="btn-primary" onClick={logActivity} disabled={status === "saving"}>
              {status === "saving" ? "Logging…" : "Log Activity"}
            </button>
            {lastLoggedDays !== null && world && (
              <p className="hint">
                Logged {lastLoggedDays} day{lastLoggedDays === 1 ? "" : "s"}.{" "}
                <button className="link-button" onClick={() => { advanceCalendar(lastLoggedDays); setLastLoggedDays(null); }} disabled={advancingCalendar}>
                  Advance calendar by {lastLoggedDays} day{lastLoggedDays === 1 ? "" : "s"}
                </button>
              </p>
            )}
          </div>

          <div className="panel result-panel">
            <h3 className="section-heading">Recent Activity</h3>
            {activities.length === 0 && (
              <EmptyState icon={<DowntimeIcon />} heading="No downtime logged yet" hint="Log what each PC did between sessions using the form below." />
            )}
            <ul className="entity-list">
              {activities.map((a) => (
                <li key={a.id} className="world-row">
                  <div>
                    <span className="entity-name">{a.characterName} · {DOWNTIME_ACTIVITY_TYPE_LABELS[a.activityType]} ({a.daysSpent}d)</span>
                    <div className="entity-meta">{a.description}{a.outcome ? ` · ${a.outcome}` : ""}</div>
                  </div>
                  {(a.userId === user?.id || world?.canWrite) && (
                    <button className="btn-danger" onClick={() => deleteActivity(a.id)} aria-label={`Delete activity for ${a.characterName}`}>Delete</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {worldId && viewMode === "travel" && (
        <div className="generator-layout">
          <div className="panel">
            <div className="page-title">
              <DowntimeIcon className="page-title-icon" aria-hidden="true" />
              <h2>Travel</h2>
            </div>
            <p className="hint">Pick an encounter table and roll a check for each leg of the journey. Not saved. Jot anything worth keeping into Session Notes.</p>

            <label className="field">
              <span>From region (optional)</span>
              {originRegion ? (
                <div className="role-slot-filled">
                  <span className="role-slot-value">{originRegion.name}</span>
                  <button className="btn-secondary" onClick={() => setOriginRegion(null)}>Clear</button>
                </div>
              ) : pickingOrigin ? (
                <EntitySearchPicker type="region" onSelect={pickOriginRegion} placeholder="Search regions…" />
              ) : (
                <button className="btn-secondary" onClick={() => setPickingOrigin(true)}>Choose Origin Region</button>
              )}
            </label>
            <label className="field">
              <span>To region (optional)</span>
              {destinationRegion ? (
                <div className="role-slot-filled">
                  <span className="role-slot-value">{destinationRegion.name}</span>
                  <button className="btn-secondary" onClick={() => setDestinationRegion(null)}>Clear</button>
                </div>
              ) : pickingDestination ? (
                <EntitySearchPicker type="region" onSelect={pickDestinationRegion} placeholder="Search regions…" />
              ) : (
                <button className="btn-secondary" onClick={() => setPickingDestination(true)}>Choose Destination Region</button>
              )}
            </label>
            {originRegion && destinationRegion && (
              <p className="hint">
                {suggestedDays === null
                  ? "No known travel route between these regions. Connect them on the World Map first."
                  : `Suggested: ${suggestedDays} day${suggestedDays === 1 ? "" : "s"} (${suggestedDays} region hop${suggestedDays === 1 ? "" : "s"} on the World Map).`}
                {suggestedDays !== null && (
                  <>
                    {" "}
                    <button className="btn-secondary" onClick={() => setDayCount(suggestedDays)}>Use suggestion</button>
                  </>
                )}
              </p>
            )}

            {!pickedTable && !pickingTable && (
              <button className="btn-secondary" onClick={() => setPickingTable(true)}>Choose an Encounter Table</button>
            )}
            {pickingTable && (
              <div className="save-panel">
                <EntitySearchPicker type="encounterTable" onSelect={pickTable} placeholder="Search encounter tables…" />
                <button className="btn-secondary" onClick={() => setPickingTable(false)}>Cancel</button>
              </div>
            )}
            {pickedTable && (
              <>
                <p className="hint">Rolling on <strong>{pickedTable.name}</strong> ({pickedTable.terrain}).</p>
                <button className="btn-secondary" onClick={() => { setPickedTable(null); setChecks([]); setDayCount(1); }}>Choose a different table</button>
                <div className="button-row">
                  <button className="btn-primary" onClick={checkForEncounter}>Check for Encounter (Day {dayCount})</button>
                </div>
                {dayCount > 1 && world && (
                  <p className="hint">
                    <button className="link-button" onClick={() => advanceCalendar(dayCount - 1)} disabled={advancingCalendar}>
                      Advance calendar by {dayCount - 1} day{dayCount - 1 === 1 ? "" : "s"}
                    </button>
                  </p>
                )}
              </>
            )}
            {error && <p className="error">{error}</p>}
          </div>

          <div className="panel result-panel">
            <h3 className="section-heading">Travel Log</h3>
            {checks.length === 0 && <p className="hint">No checks yet.</p>}
            <ul className="entity-list">
              {checks.map((c) => (
                <li key={c.id} className="world-row">
                  <div>
                    <span className="entity-name">Day {c.day} · {c.roll}</span>
                    <div className="entity-meta">{c.description}</div>
                  </div>
                  <button className="btn-secondary" disabled={c.addedToCombat} onClick={() => escalateToCombat(c)}>
                    {c.addedToCombat ? "Added to Combat" : "Escalate to Combat"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
