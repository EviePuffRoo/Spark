import { useState } from "react";
import type { SearchResult } from "@spark/shared";
import { api } from "../api";
import { EntitySearchPicker } from "./EntitySearchPicker";
import { useLocalStorage } from "../useLocalStorage";

interface Combatant {
  id: string;
  name: string;
  initiative: number;
  maxHp: number;
  currentHp: number;
  armorClass?: number;
  notes: string;
}

interface EncounterState {
  combatants: Combatant[];
  round: number;
  turnIndex: number;
}

const BLANK_ENCOUNTER: EncounterState = { combatants: [], round: 1, turnIndex: 0 };

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

export function InitiativeTracker() {
  const [encounter, setEncounter] = useLocalStorage<EncounterState>("spark-combat-encounter", BLANK_ENCOUNTER);
  const [addingFromRoster, setAddingFromRoster] = useState(false);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customInitiative, setCustomInitiative] = useState(10);
  const [customMaxHp, setCustomMaxHp] = useState(10);
  const [customAc, setCustomAc] = useState<number | "">("");
  const [hpDelta, setHpDelta] = useState<Record<string, string>>({});

  const sorted = [...encounter.combatants].sort((a, b) => b.initiative - a.initiative);
  const activeId = sorted.length > 0 ? sorted[encounter.turnIndex % sorted.length]?.id : null;

  function addCombatant(c: Combatant) {
    setEncounter((e) => ({ ...e, combatants: [...e.combatants, c] }));
  }

  async function handlePickFromRoster(result: SearchResult) {
    setAddingFromRoster(false);
    const character = await api.getCharacter(result.id);
    addCombatant({
      id: crypto.randomUUID(),
      name: character.name,
      initiative: rollD20() + abilityModifier(character.statBlock.abilityScores.dex),
      maxHp: character.statBlock.hitPointsAverage,
      currentHp: character.statBlock.hitPointsAverage,
      armorClass: character.statBlock.armorClass,
      notes: "",
    });
  }

  function handleAddCustom() {
    if (!customName.trim()) return;
    addCombatant({
      id: crypto.randomUUID(),
      name: customName.trim(),
      initiative: Number(customInitiative) || 0,
      maxHp: Number(customMaxHp) || 1,
      currentHp: Number(customMaxHp) || 1,
      armorClass: customAc === "" ? undefined : Number(customAc),
      notes: "",
    });
    setCustomName("");
    setCustomInitiative(10);
    setCustomMaxHp(10);
    setCustomAc("");
    setAddingCustom(false);
  }

  function updateCombatant(id: string, patch: Partial<Combatant>) {
    setEncounter((e) => ({ ...e, combatants: e.combatants.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  }

  function adjustHp(id: string, delta: number) {
    setEncounter((e) => ({
      ...e,
      combatants: e.combatants.map((c) =>
        c.id === id ? { ...c, currentHp: Math.max(0, Math.min(c.maxHp, c.currentHp + delta)) } : c
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
    setEncounter((e) => ({ ...e, combatants: e.combatants.filter((c) => c.id !== id) }));
  }

  function nextTurn() {
    setEncounter((e) => {
      const count = e.combatants.length;
      if (count === 0) return e;
      const next = e.turnIndex + 1;
      return next >= count ? { ...e, turnIndex: 0, round: e.round + 1 } : { ...e, turnIndex: next };
    });
  }

  function clearEncounter() {
    if (!confirm("Clear the current encounter? This cannot be undone.")) return;
    setEncounter(BLANK_ENCOUNTER);
  }

  return (
    <div className="panel result-panel initiative-tracker">
      <div className="initiative-header">
        <h2>Initiative Tracker</h2>
        <span className="round-banner">Round {encounter.round}</span>
      </div>

      <div className="button-row">
        <button className="btn-secondary" onClick={() => { setAddingFromRoster((v) => !v); setAddingCustom(false); }}>+ Add from Roster</button>
        <button className="btn-secondary" onClick={() => { setAddingCustom((v) => !v); setAddingFromRoster(false); }}>+ Add Custom</button>
        {encounter.combatants.length > 0 && <button className="btn-secondary" onClick={nextTurn}>Next Turn</button>}
        {encounter.combatants.length > 0 && <button className="btn-danger" onClick={clearEncounter}>Clear Encounter</button>}
      </div>

      {addingFromRoster && (
        <div className="save-panel">
          <EntitySearchPicker type="character" onSelect={handlePickFromRoster} placeholder="Search NPCs & monsters…" />
        </div>
      )}

      {addingCustom && (
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
          <button className="btn-primary" onClick={handleAddCustom}>Add Combatant</button>
        </div>
      )}

      {sorted.length === 0 && <p className="hint">No combatants yet. Add from the roster or add a custom entry (e.g. a PC).</p>}

      <ul className="combatant-list">
        {sorted.map((c) => (
          <li key={c.id} className={`combatant-row${c.id === activeId ? " active-turn" : ""}${c.currentHp <= 0 ? " down" : ""}`}>
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
              <input
                type="text"
                className="combatant-notes"
                value={c.notes}
                onChange={(e) => updateCombatant(c.id, { notes: e.target.value })}
                placeholder="conditions, notes…"
              />
              <button className="btn-danger" onClick={() => removeCombatant(c.id)} aria-label={`Remove ${c.name}`}>Remove</button>
            </div>
            <div className="combatant-hp">
              <span className="combatant-hp-value">{c.currentHp} / {c.maxHp} HP</span>
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
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
