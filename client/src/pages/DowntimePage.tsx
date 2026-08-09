import { useEffect, useState } from "react";
import type { DowntimeActivity, DowntimeActivityType, EncounterTable, LiveCombatant, EncounterStateInput, SearchResult } from "@spark/shared";
import { DOWNTIME_ACTIVITY_TYPES, DOWNTIME_ACTIVITY_TYPE_LABELS } from "@spark/shared";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useActiveWorld } from "../ActiveWorldContext";
import { EntitySearchPicker } from "../components/EntitySearchPicker";
import { rollTableIndex } from "../rollTable";
import { DowntimeIcon } from "../components/icons";
import { EmptyState } from "../components/EmptyState";

interface TravelCheck {
  id: string;
  day: number;
  roll: string;
  description: string;
  addedToCombat: boolean;
}

export function DowntimePage() {
  const { user } = useAuth();
  const { worldId } = useActiveWorld();
  const [viewMode, setViewMode] = useState<"log" | "travel">("log");

  const [activities, setActivities] = useState<DowntimeActivity[]>([]);
  const [characterName, setCharacterName] = useState("");
  const [activityType, setActivityType] = useState<DowntimeActivityType>("training");
  const [description, setDescription] = useState("");
  const [daysSpent, setDaysSpent] = useState("1");
  const [outcome, setOutcome] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  const [pickedTable, setPickedTable] = useState<EncounterTable | null>(null);
  const [pickingTable, setPickingTable] = useState(false);
  const [dayCount, setDayCount] = useState(1);
  const [checks, setChecks] = useState<TravelCheck[]>([]);

  function refresh() {
    if (!worldId) {
      setActivities([]);
      return;
    }
    api.listDowntimeActivities(worldId).then(setActivities).catch(() => {});
  }

  useEffect(refresh, [worldId]);

  async function logActivity() {
    if (!worldId || !characterName.trim() || !description.trim()) return;
    const days = Math.max(1, Math.trunc(Number(daysSpent)) || 1);
    setStatus("saving");
    setError(null);
    try {
      await api.postDowntimeActivity({
        worldId,
        characterName: characterName.trim(),
        activityType,
        description: description.trim(),
        daysSpent: days,
        outcome: outcome.trim() || undefined,
      });
      setDescription("");
      setOutcome("");
      setDaysSpent("1");
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
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
              <input type="text" value={characterName} onChange={(e) => setCharacterName(e.target.value)} placeholder="e.g. Aria" />
            </label>
            <label className="field">
              <span>Activity type</span>
              <select value={activityType} onChange={(e) => setActivityType(e.target.value as DowntimeActivityType)}>
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
              <input type="text" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Gained proficiency, made a contact…" />
            </label>

            {error && <p className="error">{error}</p>}
            <button className="btn-primary" onClick={logActivity} disabled={status === "saving"}>
              {status === "saving" ? "Logging…" : "Log Activity"}
            </button>
          </div>

          <div className="panel result-panel">
            <h3 className="section-heading">Recent Activity</h3>
            {activities.length === 0 && (
              <EmptyState icon={<DowntimeIcon />} heading="No downtime logged yet" hint="Log what each PC did between sessions using the form on the left." />
            )}
            <ul className="entity-list">
              {activities.map((a) => (
                <li key={a.id} className="world-row">
                  <div>
                    <span className="entity-name">{a.characterName} — {DOWNTIME_ACTIVITY_TYPE_LABELS[a.activityType]} ({a.daysSpent}d)</span>
                    <div className="entity-meta">{a.description}{a.outcome ? ` — ${a.outcome}` : ""}</div>
                  </div>
                  {(a.userId === user?.id) && (
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
            <p className="hint">Pick an encounter table and roll a check for each leg of the journey. Not saved — jot anything worth keeping into Session Notes.</p>

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
                    <span className="entity-name">Day {c.day} — {c.roll}</span>
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
