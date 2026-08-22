import { useState } from "react";
import type { PlayerCharacter } from "@spark/shared";
import { PC_CLASSES, levelForXp, XP_THRESHOLDS, computeLevelUpChanges } from "@spark/shared";
import { api } from "../api";

// Two leveling styles coexist, matching PlayerCharacter.xp's doc comment:
// a milestone table can just ignore the XP row entirely and pick any
// target level directly; an XP-tracking table awards XP here and gets a
// "Ready to level up" nudge once it crosses the next threshold. Either
// path funnels through the same Level Up action so HP/spell slots/class
// resource/proficiency all update together — never through a raw level
// edit, which (still available via the character editor) has none of
// these side effects.
export function LevelUpPanel({ pc, onUpdated }: { pc: PlayerCharacter; onUpdated: (updated: PlayerCharacter) => void }) {
  const canLevelUp = pc.level < 20;
  const eligibleLevel = levelForXp(pc.xp);
  const [targetLevel, setTargetLevel] = useState(() => Math.min(20, Math.max(pc.level + 1, eligibleLevel)));
  const [xpAward, setXpAward] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  const pcClass = PC_CLASSES.find((c) => c.name === pc.className);
  const conMod = Math.floor((pc.abilityScores.con - 10) / 2);
  const preview = canLevelUp ? computeLevelUpChanges(pcClass, pc.level, targetLevel, conMod) : null;

  async function handleAwardXp() {
    const amount = Number(xpAward);
    if (!amount) return;
    setStatus("saving");
    setError(null);
    try {
      const updated = await api.updatePlayerCharacter(pc.id, { xp: pc.xp + amount });
      setXpAward("");
      onUpdated(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  async function handleLevelUp() {
    setStatus("saving");
    setError(null);
    try {
      const updated = await api.levelUpPlayerCharacter(pc.id, targetLevel);
      onUpdated(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="level-up-panel">
      <h3 className="section-heading">Experience</h3>
      <p>
        <strong>XP</strong> {pc.xp.toLocaleString()}
        {pc.level < 20 ? ` (${XP_THRESHOLDS[pc.level].toLocaleString()} for level ${pc.level + 1})` : " (max level)"}
      </p>
      <div className="button-row">
        <input type="number" min={1} value={xpAward} onChange={(e) => setXpAward(e.target.value)} placeholder="Award XP" />
        <button className="btn-secondary" onClick={handleAwardXp} disabled={status === "saving" || !xpAward}>Add XP</button>
      </div>

      {eligibleLevel > pc.level && <p className="success">Ready to level up to {eligibleLevel}!</p>}

      {canLevelUp && (
        <>
          <div className="button-row">
            <label className="field">
              <span>Level up to</span>
              <select value={targetLevel} onChange={(e) => setTargetLevel(Number(e.target.value))}>
                {Array.from({ length: 20 - pc.level }, (_, i) => pc.level + 1 + i).map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </label>
            <button className="btn-primary" onClick={handleLevelUp} disabled={status === "saving"}>Level Up</button>
          </div>
          {preview && preview.classMatched && (
            <p className="hint">
              +{preview.hpGain} HP, proficiency bonus +{preview.proficiencyBonus}
              {preview.spellSlots.length > 0 && `, spell slots: ${preview.spellSlots.map((s) => `${s.max} (L${s.level})`).join(", ")}`}
              {preview.classResource && `, ${preview.classResource.name}: ${preview.classResource.max}`}
            </p>
          )}
          {preview && !preview.classMatched && (
            <p className="hint">+{preview.hpGain} HP, proficiency bonus +{preview.proficiencyBonus} (class not recognized — spell slots/class resource left unchanged)</p>
          )}
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
