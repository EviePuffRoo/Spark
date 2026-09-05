import { useState } from "react";
import type { LiveCombatant, SpellDef } from "@spark/shared";
import { SPELL_EFFECTS } from "@spark/shared";
import { parseNotation, rollDice } from "./DiceRoller";
import { rollD20 } from "./AddCombatantPanel";

export interface RollAnnouncement {
  notation: string;
  results: number[];
  modifier: number;
  total: number;
  mode?: "adv" | "dis";
}

// The spellcasting panel that opens under a caster's row: pick a prepared
// spell, resolve it (attack roll, saving throw, or automatic), and apply
// its damage or healing.
//
// Like AttackPanel, this used to keep all of its state in InitiativeTracker
// next to the battle grid, so every keystroke here re-rendered the map. The
// panel owns its own resolution state; anything that mutates the shared
// encounter — spending a slot, setting concentration, changing HP, applying
// a condition, handing an area roll to the grid template — stays with the
// tracker and arrives here as a callback, since the tracker is what owns
// that state and syncs it to the party.
export function CastPanel({
  caster, combatants, spellsById,
  onApplyHp, onCommitCast, onApplyCondition, onAreaDamageRolled, onAnnounceRoll,
}: {
  caster: LiveCombatant;
  combatants: LiveCombatant[];
  spellsById: Map<string, SpellDef>;
  // Negative to damage, positive to heal — matches the tracker's own adjustHp.
  onApplyHp: (targetId: string, delta: number) => void;
  // Spends a slot for a levelled spell and sets concentration if the spell
  // needs it. Called once per cast, on whichever roll resolves it first.
  onCommitCast: (caster: LiveCombatant, spellId: string) => void;
  onApplyCondition: (targetId: string, conditionName: string) => void;
  // An area spell doesn't have a single target — the rolled damage goes to
  // the grid's template controls to apply to everyone caught in it.
  onAreaDamageRolled: (total: number) => void;
  onAnnounceRoll: (roller: LiveCombatant, payload: RollAnnouncement, label: string) => void;
}) {
  const castable = (caster.preparedSpells ?? []).filter((id) => SPELL_EFFECTS[id]);
  const [spellId, setSpellId] = useState(castable[0] ?? "");
  const [targetId, setTargetId] = useState(combatants.find((t) => t.id !== caster.id)?.id ?? "");
  const [saveBonus, setSaveBonus] = useState("0");
  const [advMode, setAdvMode] = useState<"normal" | "adv" | "dis">("normal");
  const [attackRollResult, setAttackRollResult] = useState<{ rolls: number[]; total: number; hit: boolean | null } | null>(null);
  const [saveRollResult, setSaveRollResult] = useState<{ rolls: number[]; total: number; success: boolean } | null>(null);
  const [damageRolled, setDamageRolled] = useState<{ total: number } | null>(null);
  const [resolved, setResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectSpell(id: string) {
    setSpellId(id);
    setAttackRollResult(null);
    setSaveRollResult(null);
    setDamageRolled(null);
    setResolved(false);
    setError(null);
  }

  // Slot spend and concentration happen once per cast, on whichever roll
  // resolves it first — guarded here rather than in the tracker so the
  // tracker's callback stays a plain "do it" with no ordering knowledge.
  function commit(id: string) {
    if (resolved) return;
    setResolved(true);
    onCommitCast(caster, id);
  }

  function rollCastAttack() {
    const spell = spellsById.get(spellId);
    const effect = SPELL_EFFECTS[spellId];
    const target = combatants.find((t) => t.id === targetId);
    if (!spell || !effect || effect.resolve.kind !== "damage") return;
    commit(spellId);
    const bonus = caster.spellAttackBonus ?? 0;
    const rolls = advMode === "normal" ? [rollD20()] : [rollD20(), rollD20()];
    const kept = advMode === "dis" ? Math.min(...rolls) : Math.max(...rolls);
    const total = kept + bonus;
    const hit = target?.armorClass !== undefined ? total >= target.armorClass : null;
    setAttackRollResult({ rolls, total, hit });
    setDamageRolled(null);
    if (target) {
      const acNote = target.armorClass !== undefined ? ` (AC ${target.armorClass})` : "";
      const outcome = hit === null ? "" : hit ? ": HIT" : ": MISS";
      onAnnounceRoll(caster, {
        notation: "1d20", results: rolls, modifier: bonus, total, mode: advMode === "normal" ? undefined : advMode,
      }, `${spell.name}: ${caster.name} vs ${target.name}${acNote}${outcome}`);
    }
  }

  function rollCastSave() {
    const spell = spellsById.get(spellId);
    const effect = SPELL_EFFECTS[spellId];
    const target = combatants.find((t) => t.id === targetId);
    if (!spell || !effect || !target) return;
    const resolve = effect.resolve;
    const save = resolve.kind === "damage" ? resolve.save : resolve.kind === "condition" ? resolve.save : undefined;
    if (!save) return;
    commit(spellId);
    const bonus = Number(saveBonus) || 0;
    const roll = rollD20();
    const total = roll + bonus;
    const success = caster.spellSaveDc !== undefined && total >= caster.spellSaveDc;
    setSaveRollResult({ rolls: [roll], total, success });
    setDamageRolled(null);
    const dcNote = caster.spellSaveDc !== undefined ? ` (DC ${caster.spellSaveDc})` : "";
    onAnnounceRoll(target, {
      notation: "1d20", results: [roll], modifier: bonus, total,
    }, `${spell.name}${dcNote}: ${target.name}'s ${save.ability.toUpperCase()} save${success ? " — SUCCESS" : " — FAIL"}`);
    if (resolve.kind === "condition" && !success) {
      onApplyCondition(target.id, resolve.condition);
    }
  }

  function rollCastDamage() {
    const spell = spellsById.get(spellId);
    const effect = SPELL_EFFECTS[spellId];
    if (!spell || !effect || effect.resolve.kind !== "damage") return;
    const resolve = effect.resolve;
    const parsed = parseNotation(resolve.diceExpr);
    if (!parsed) {
      setError(`Can't parse "${resolve.diceExpr}".`);
      return;
    }
    setError(null);
    const results = rollDice(parsed.count, parsed.sides);
    const rolledTotal = Math.max(0, results.reduce((sum, r) => sum + r, 0) + parsed.modifier);

    if (effect.area) {
      commit(spellId);
      setDamageRolled({ total: rolledTotal });
      onAreaDamageRolled(rolledTotal);
      onAnnounceRoll(caster, {
        notation: resolve.diceExpr, results, modifier: parsed.modifier, total: rolledTotal,
      }, `${spell.name} damage (${caster.name}) — apply to everyone in the template below`);
      return;
    }

    const target = combatants.find((t) => t.id === targetId);
    if (!target) return;

    let appliedTotal = rolledTotal;
    if (resolve.attackRoll) {
      if (attackRollResult?.hit === false) return; // missed — nothing to apply
    } else if (resolve.save) {
      if (!saveRollResult) return; // roll the save first
      if (saveRollResult.success) appliedTotal = resolve.save.halfOnSuccess ? Math.floor(rolledTotal / 2) : 0;
    } else {
      commit(spellId); // auto-hit, no prior roll step
    }

    setDamageRolled({ total: appliedTotal });
    onApplyHp(target.id, -appliedTotal);
    onAnnounceRoll(caster, {
      notation: resolve.diceExpr, results, modifier: parsed.modifier, total: rolledTotal,
    }, `${spell.name} damage: ${caster.name} vs ${target.name} — applied ${appliedTotal}`);
  }

  function rollCastHeal() {
    const spell = spellsById.get(spellId);
    const effect = SPELL_EFFECTS[spellId];
    const target = combatants.find((t) => t.id === targetId);
    if (!spell || !effect || effect.resolve.kind !== "heal" || !target) return;
    const parsed = parseNotation(effect.resolve.diceExpr);
    if (!parsed) {
      setError(`Can't parse "${effect.resolve.diceExpr}".`);
      return;
    }
    setError(null);
    commit(spellId);
    const results = rollDice(parsed.count, parsed.sides);
    const total = Math.max(0, results.reduce((sum, r) => sum + r, 0) + parsed.modifier);
    setDamageRolled({ total });
    onApplyHp(target.id, total);
    onAnnounceRoll(caster, {
      notation: effect.resolve.diceExpr, results, modifier: parsed.modifier, total,
    }, `${spell.name}: ${caster.name} heals ${target.name} for ${total}`);
  }

  const spell = spellsById.get(spellId);
  const effect = SPELL_EFFECTS[spellId];

  return (
    <div className="save-panel cast-panel">
      <label className="field">
        <span>Spell</span>
        <select value={spellId} onChange={(e) => selectSpell(e.target.value)}>
          {castable.map((id) => {
            const s = spellsById.get(id);
            return <option key={id} value={id}>{s?.name ?? id}{s ? ` (${s.level === 0 ? "Cantrip" : `Lvl ${s.level}`})` : ""}</option>;
          })}
        </select>
      </label>
      {spell && effect && (() => {
        const resolve = effect.resolve;
        const slotsAtLevel = spell.level > 0 ? caster.spellSlots?.find((s) => s.level === spell.level) : undefined;
        const atkBonus = caster.spellAttackBonus ?? 0;
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
                <button className="btn-primary" onClick={rollCastDamage}>Roll Damage</button>
              </>
            ) : (
              <>
                <label className="field">
                  <span>Target</span>
                  <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                    {combatants.filter((t) => t.id !== caster.id).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}{t.armorClass !== undefined ? ` (AC ${t.armorClass})` : ""}</option>
                    ))}
                  </select>
                </label>

                {resolve.kind === "damage" && resolve.attackRoll && (
                  <>
                    <p className="hint">Spell attack bonus: {atkBonus >= 0 ? `+${atkBonus}` : atkBonus}</p>
                    <div className="tabs apply-mode-toggle" role="tablist">
                      <button role="tab" className={advMode === "normal" ? "active" : ""} aria-selected={advMode === "normal"} onClick={() => setAdvMode("normal")}>Normal</button>
                      <button role="tab" className={advMode === "adv" ? "active" : ""} aria-selected={advMode === "adv"} onClick={() => setAdvMode("adv")}>Advantage</button>
                      <button role="tab" className={advMode === "dis" ? "active" : ""} aria-selected={advMode === "dis"} onClick={() => setAdvMode("dis")}>Disadvantage</button>
                    </div>
                    <button className="btn-primary" onClick={rollCastAttack}>Roll to Hit</button>
                    {attackRollResult && (
                      <p className="encounter-roll-result" role="status">
                        Rolled [{attackRollResult.rolls.join(", ")}] + {atkBonus} = <strong className="mono">{attackRollResult.total}</strong>
                        {": "}
                        {attackRollResult.hit === null ? "target has no AC set" : attackRollResult.hit ? <strong>HIT</strong> : <strong>MISS</strong>}
                      </p>
                    )}
                    {attackRollResult?.hit !== false && (
                      <button className="btn-primary" onClick={rollCastDamage}>Roll Damage &amp; Apply</button>
                    )}
                  </>
                )}

                {save && !(resolve.kind === "damage" && resolve.attackRoll) && (
                  <>
                    <p className="hint">Spell save DC {caster.spellSaveDc ?? "—"} ({save.ability.toUpperCase()})</p>
                    <label className="field">
                      <span>Target's save bonus</span>
                      <input type="number" value={saveBonus} onChange={(e) => setSaveBonus(e.target.value)} />
                    </label>
                    <button className="btn-primary" onClick={rollCastSave}>Roll Save</button>
                    {saveRollResult && (
                      <p className="encounter-roll-result" role="status">
                        Rolled [{saveRollResult.rolls[0]}] + {Number(saveBonus) || 0} = <strong className="mono">{saveRollResult.total}</strong>
                        {": "}
                        {saveRollResult.success ? <strong>SUCCESS</strong> : <strong>FAIL</strong>}
                      </p>
                    )}
                    {resolve.kind === "damage" && saveRollResult && (
                      <button className="btn-primary" onClick={rollCastDamage}>Roll Damage &amp; Apply</button>
                    )}
                  </>
                )}

                {resolve.kind === "damage" && !resolve.attackRoll && !resolve.save && (
                  <button className="btn-primary" onClick={rollCastDamage}>Roll Damage &amp; Apply</button>
                )}

                {resolve.kind === "heal" && (
                  <button className="btn-primary" onClick={rollCastHeal}>Roll Healing &amp; Apply</button>
                )}

                {error && <p className="error">{error}</p>}
                {damageRolled && (
                  <p className="encounter-roll-result" role="status">
                    {resolve.kind === "heal" ? `Healed ${damageRolled.total}.` : `Applied ${damageRolled.total} damage.`}
                  </p>
                )}
              </>
            )}
          </>
        );
      })()}
    </div>
  );
}
