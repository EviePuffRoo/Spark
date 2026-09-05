import { useState } from "react";
import type { LiveCombatant } from "@spark/shared";
import { api } from "../api";
import { parseNotation, rollDice } from "./DiceRoller";
import { rollD20 } from "./AddCombatantPanel";

// The attack-resolution panel that opens under a combatant's row: pick a
// target, roll to hit against its AC, then roll damage and apply it.
//
// All of this state used to live in InitiativeTracker alongside the battle
// grid, which meant every keystroke in "to-hit bonus" or "damage dice"
// re-rendered the whole tracker, map included. It's self-contained — the
// tracker only needs to know which row has a panel open — so it owns its
// own state here and re-renders alone.
export function AttackPanel({
  attacker, combatants, onApplyDamage, partyWorldId,
}: {
  attacker: LiveCombatant;
  // Everyone in the encounter, in initiative order — the attacker is
  // filtered out of the target list below.
  combatants: LiveCombatant[];
  onApplyDamage: (targetId: string, amount: number) => void;
  // The world to announce rolls into, or null when not running in party
  // mode (a solo DM's rolls aren't broadcast anywhere).
  partyWorldId: string | null;
}) {
  const firstAttack = attacker.attacks?.[0];
  const [targetId, setTargetId] = useState(combatants.find((t) => t.id !== attacker.id)?.id ?? "");
  const [choice, setChoice] = useState(firstAttack?.name ?? "");
  const [toHitBonus, setToHitBonus] = useState(String(firstAttack?.toHitBonus ?? 0));
  const [damageDice, setDamageDice] = useState(firstAttack?.damageDice ?? "1d6");
  const [advMode, setAdvMode] = useState<"normal" | "adv" | "dis">("normal");
  const [rollResult, setRollResult] = useState<{ rolls: number[]; total: number; hit: boolean | null } | null>(null);
  const [damageResult, setDamageResult] = useState<{ total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function selectAttack(name: string) {
    setChoice(name);
    const found = attacker.attacks?.find((a) => a.name === name);
    setToHitBonus(String(found?.toHitBonus ?? 0));
    setDamageDice(found?.damageDice ?? "1d6");
    setRollResult(null);
    setDamageResult(null);
    setError(null);
  }

  async function announce(payload: {
    notation: string; results: number[]; modifier: number; total: number; mode?: "adv" | "dis";
  }, label: string) {
    if (!partyWorldId) return;
    try {
      await api.postRollLogEntry({ worldId: partyWorldId, rollerName: attacker.name, hiddenFromParty: false, label, ...payload });
    } catch {
      // Best-effort party announcement — the attack itself already resolved locally either way.
    }
  }

  function rollToHit() {
    const target = combatants.find((t) => t.id === targetId);
    const bonus = Number(toHitBonus) || 0;
    const rolls = advMode === "normal" ? [rollD20()] : [rollD20(), rollD20()];
    const kept = advMode === "dis" ? Math.min(...rolls) : Math.max(...rolls);
    const total = kept + bonus;
    const hit = target?.armorClass !== undefined ? total >= target.armorClass : null;
    setRollResult({ rolls, total, hit });
    setDamageResult(null);
    if (target) {
      const acNote = target.armorClass !== undefined ? ` (AC ${target.armorClass})` : "";
      const outcome = hit === null ? "" : hit ? ": HIT" : ": MISS";
      announce({
        notation: "1d20", results: rolls, modifier: bonus, total, mode: advMode === "normal" ? undefined : advMode,
      }, `${choice || "Attack"}: ${attacker.name} vs ${target.name}${acNote}${outcome}`);
    }
  }

  function rollDamage() {
    const target = combatants.find((t) => t.id === targetId);
    if (!target) return;
    const parsed = parseNotation(damageDice);
    if (!parsed) {
      setError(`Can't parse "${damageDice}". Try something like 1d8+3.`);
      return;
    }
    setError(null);
    const results = rollDice(parsed.count, parsed.sides);
    const total = Math.max(0, results.reduce((sum, r) => sum + r, 0) + parsed.modifier);
    setDamageResult({ total });
    onApplyDamage(target.id, total);
    announce({
      notation: damageDice, results, modifier: parsed.modifier, total,
    }, `${choice || "Attack"} damage: ${attacker.name} vs ${target.name}`);
  }

  const selected = attacker.attacks?.find((a) => a.name === choice);

  return (
    <div className="save-panel attack-panel">
      <label className="field">
        <span>Target</span>
        <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          {combatants.filter((t) => t.id !== attacker.id).map((t) => (
            <option key={t.id} value={t.id}>{t.name}{t.armorClass !== undefined ? ` (AC ${t.armorClass})` : ""}</option>
          ))}
        </select>
      </label>
      {!!attacker.attacks?.length && (
        <label className="field">
          <span>Attack</span>
          <select value={choice} onChange={(e) => selectAttack(e.target.value)}>
            {attacker.attacks.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
            <option value="">Manual attack</option>
          </select>
        </label>
      )}
      {selected?.savingThrow && (
        <p className="hint">
          Also calls for a DC {selected.savingThrow.dc} {selected.savingThrow.ability.toUpperCase()} saving throw. Resolve that separately.
        </p>
      )}
      <label className="field">
        <span>To-hit bonus</span>
        <input type="number" value={toHitBonus} onChange={(e) => setToHitBonus(e.target.value)} />
      </label>
      <div className="tabs apply-mode-toggle" role="tablist">
        <button role="tab" className={advMode === "normal" ? "active" : ""} aria-selected={advMode === "normal"} onClick={() => setAdvMode("normal")}>Normal</button>
        <button role="tab" className={advMode === "adv" ? "active" : ""} aria-selected={advMode === "adv"} onClick={() => setAdvMode("adv")}>Advantage</button>
        <button role="tab" className={advMode === "dis" ? "active" : ""} aria-selected={advMode === "dis"} onClick={() => setAdvMode("dis")}>Disadvantage</button>
      </div>
      <button className="btn-primary" onClick={rollToHit}>Roll to Hit</button>
      {rollResult && (
        <p className="encounter-roll-result" role="status">
          Rolled [{rollResult.rolls.join(", ")}]{toHitBonus !== "0" ? ` + ${toHitBonus}` : ""} = <strong className="mono">{rollResult.total}</strong>
          {": "}
          {rollResult.hit === null ? "target has no AC set" : rollResult.hit ? <strong>HIT</strong> : <strong>MISS</strong>}
        </p>
      )}
      {rollResult?.hit !== false && (
        <>
          <label className="field">
            <span>Damage dice</span>
            <input type="text" value={damageDice} onChange={(e) => setDamageDice(e.target.value)} placeholder="e.g. 1d8+3" />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn-primary" onClick={rollDamage}>Roll Damage &amp; Apply</button>
          {damageResult && (
            <p className="encounter-roll-result" role="status">Applied {damageResult.total} damage.</p>
          )}
        </>
      )}
    </div>
  );
}
