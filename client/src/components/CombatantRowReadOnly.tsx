import type { HpStatus, LiveCombatant } from "@spark/shared";
import { HpBar } from "./HpBar";

const HP_STATUS_LABELS: Record<HpStatus, string> = {
  healthy: "Healthy",
  injured: "Injured",
  bloodied: "Bloodied",
  nearDeath: "Near Death",
  down: "Down",
};

// The party-facing view of a combatant row — read-only, no per-row local
// state, so it's a pure function of the combatant and whether it's their
// turn. Used in Party mode by anyone who isn't the world's owner.
export function CombatantRowReadOnly({ c, isActive }: { c: LiveCombatant; isActive: boolean }) {
  return (
    <li className={`combatant-row read-only${isActive ? " active-turn" : ""}${c.hpStatus === "down" ? " down" : ""}`}>
      <div className="combatant-main">
        <span className="combatant-initiative-readonly mono">{c.initiative}</span>
        <span className="combatant-name">{c.name}</span>
        {c.armorClass !== undefined && (
          <span className="entity-meta">
            AC {c.armorClass}
            {!!c.equipmentAcBonus && <span className="item-stat-badge" title={`Includes +${c.equipmentAcBonus} from equipped items`}>+{c.equipmentAcBonus} equipped</span>}
          </span>
        )}
        {c.speedFeet !== undefined && <span className="entity-meta">Speed {c.speedFeet} ft</span>}
        {c.flying && <span className="entity-meta">Flying</span>}
        {c.legendaryActionsMax !== undefined && (
          <span className="legendary-pips" title={`${c.legendaryActionsRemaining ?? 0} of ${c.legendaryActionsMax} legendary actions remaining`}>
            {"⚡".repeat(Math.max(0, c.legendaryActionsRemaining ?? 0))}{"·".repeat(Math.max(0, c.legendaryActionsMax - (c.legendaryActionsRemaining ?? 0)))}
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
  );
}
