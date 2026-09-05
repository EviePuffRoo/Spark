import { useState } from "react";
import type { LiveCombatant, SpellDef, ZoneHazard } from "@spark/shared";
import { CONDITIONS_COMPENDIUM, SPELL_EFFECTS } from "@spark/shared";
import { HpBar } from "./HpBar";
import { AttackPanel } from "./AttackPanel";
import { CastPanel, type RollAnnouncement } from "./CastPanel";
import { LootPanel } from "./LootPanel";

// One combatant's row in the tracker: name and vitals, plus the eleven
// controls a DM reaches for mid-turn — attack, cast, conditions,
// concentration, carried light, flying, legendary actions, notes, hazard,
// HP, loot.
//
// The fourth extraction out of InitiativeTracker, after attack, cast and
// loot, and the one those three were leading to: they moved a panel each,
// but the row that opens them was still ~370 lines of JSX inside a .map(),
// so every one of those eleven controls had to be read past to find any
// other. The tracker now hands this a combatant and a set of actions and
// says nothing about how a row is laid out.
//
// It also stops a keystroke reaching the battle map. The HP amount, the
// condition duration, the concentration spell name and the carried-light
// distance were four pieces of tracker state keyed by combatant id, so
// typing any of them re-rendered the tracker and, under it, the grid. They
// are local to a row now, which is where they were always scoped anyway.

const CONDITIONS = CONDITIONS_COMPENDIUM.map((c) => c.name);

const LIGHT_PRESETS: { label: string; feet: number }[] = [
  { label: "Candle", feet: 5 },
  { label: "Torch", feet: 20 },
  { label: "Lantern", feet: 30 },
];

// Which of a row's expandable panels is showing. One name rather than a
// boolean per panel: these were six separate `xOpenFor` states on the
// tracker, which meant adding a panel meant adding a seventh, and nothing
// stopped three of them being open at once on the same row.
export type CombatantPanel = "attack" | "cast" | "conditions" | "concentration" | "light" | "loot";

// Everything a row can do to the encounter. Grouped into one object rather
// than a dozen sibling props because the encounter is the tracker's to own
// and sync to the party — a row never writes it directly — and because
// this row has grown by "one more per-combatant action" enough times that
// adding the next one should mean a line here and a call site, not another
// prop threaded through the tracker's JSX.
export interface CombatantActions {
  update: (id: string, patch: Partial<LiveCombatant>) => void;
  remove: (id: string) => void;
  // durationRounds is the row's own input, passed up rather than read back
  // out of tracker state — it only ever mattered at the moment of the click.
  toggleCondition: (id: string, name: string, durationRounds: number | null) => void;
  adjustHp: (id: string, delta: number) => void;
  rest: (id: string) => void;
  flee: (id: string) => void;
  spendLegendaryAction: (id: string, cost: number) => void;
  commitCast: (caster: LiveCombatant, spellId: string) => void;
  applyCastCondition: (targetId: string, conditionName: string) => void;
  announceRoll: (roller: LiveCombatant, payload: RollAnnouncement, label: string) => void;
  areaDamageRolled: (total: number) => void;
  dismissConcentrationPrompt: () => void;
}

export function CombatantRow({
  c, isActive, round, combatants, spellsById,
  partyMode, partyWorldId, canFlee, onBattleMap, hazard,
  concentrationPrompt, lootAuthorName,
  openPanel, onOpenPanel, actions,
}: {
  c: LiveCombatant;
  isActive: boolean;
  round: number;
  // Everyone in the encounter, in initiative order — the attack and cast
  // panels pick their targets from it.
  combatants: LiveCombatant[];
  spellsById: Map<string, SpellDef>;
  partyMode: boolean;
  partyWorldId: string;
  // The party is in a dungeon room a monster could run from.
  canFlee: boolean;
  // A battle map is loaded, so the grid-only controls (carried light,
  // flying) have something to act on.
  onBattleMap: boolean;
  // The hazard of the zone this combatant is standing in, if any.
  hazard: ZoneHazard | null;
  // Set only while this combatant has an unresolved concentration save.
  concentrationPrompt: { spell: string; dc: number } | null;
  lootAuthorName: string;
  // Null when this row has no panel open. At most one row in the tracker
  // has a non-null value.
  openPanel: CombatantPanel | null;
  onOpenPanel: (panel: CombatantPanel | null) => void;
  actions: CombatantActions;
}) {
  const [hpAmount, setHpAmount] = useState("");
  const [conditionDuration, setConditionDuration] = useState("");
  const [concentrationInput, setConcentrationInput] = useState("");
  const [lightInput, setLightInput] = useState("");

  const currentHp = c.currentHp ?? 0;
  const toggle = (panel: CombatantPanel) => onOpenPanel(openPanel === panel ? null : panel);

  function applyDelta(sign: 1 | -1) {
    const amount = Number(hpAmount);
    if (!hpAmount || Number.isNaN(amount) || amount <= 0) return;
    actions.adjustHp(c.id, sign * amount);
    setHpAmount("");
  }

  function addCondition(name: string) {
    const rounds = Number(conditionDuration);
    actions.toggleCondition(c.id, name, Number.isFinite(rounds) && rounds > 0 ? rounds : null);
  }

  return (
    <li className={`combatant-row${isActive ? " active-turn" : ""}${currentHp <= 0 ? " down" : ""}`}>
      <div className="combatant-main">
        <input
          type="number"
          className="combatant-initiative mono"
          value={c.initiative}
          onChange={(e) => actions.update(c.id, { initiative: Number(e.target.value) })}
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
        {combatants.length > 1 && (
          <button className="btn-secondary" aria-expanded={openPanel === "attack"} onClick={() => toggle("attack")}>
            ⚔ Attack
          </button>
        )}
        {c.preparedSpells?.some((id) => SPELL_EFFECTS[id]) && (
          <button className="btn-secondary" aria-expanded={openPanel === "cast"} onClick={() => toggle("cast")}>
            ✨ Cast
          </button>
        )}
        {c.kind === "monster" && canFlee && (
          <button className="btn-secondary" onClick={() => actions.flee(c.id)} aria-label={`${c.name} flees`}>Flee</button>
        )}
        <button className="btn-danger" onClick={() => actions.remove(c.id)} aria-label={`Remove ${c.name}`}>Remove</button>
      </div>

      {openPanel === "attack" && (
        <AttackPanel
          attacker={c}
          combatants={combatants}
          onApplyDamage={(targetId, amount) => actions.adjustHp(targetId, -amount)}
          partyWorldId={partyMode ? partyWorldId : null}
        />
      )}

      {openPanel === "cast" && (
        <CastPanel
          caster={c}
          combatants={combatants}
          spellsById={spellsById}
          onApplyHp={actions.adjustHp}
          onCommitCast={actions.commitCast}
          onApplyCondition={actions.applyCastCondition}
          onAreaDamageRolled={actions.areaDamageRolled}
          onAnnounceRoll={actions.announceRoll}
        />
      )}

      <div className="combatant-conditions">
        {c.conditions.map((cond) => {
          const expired = cond.expiresAtRound !== null && cond.expiresAtRound < round;
          return (
            <span key={cond.name} className={`condition-chip${expired ? " condition-chip-expired" : ""}`}>
              {cond.name}
              {cond.expiresAtRound !== null && ` (until round ${cond.expiresAtRound})`}
              <button onClick={() => actions.toggleCondition(c.id, cond.name, null)} aria-label={`Remove ${cond.name} from ${c.name}`}>×</button>
            </span>
          );
        })}
        <button className="btn-secondary condition-toggle" aria-expanded={openPanel === "conditions"} onClick={() => toggle("conditions")}>
          + Condition
        </button>
        {openPanel === "conditions" && (
          <div className="condition-picker">
            <label className="field condition-duration-field">
              <span>Duration in rounds (optional)</span>
              <input
                type="number"
                min={1}
                value={conditionDuration}
                onChange={(e) => setConditionDuration(e.target.value)}
                placeholder="indefinite"
              />
            </label>
            {CONDITIONS.map((cond) => (
              <button
                key={cond}
                className={c.conditions.some((x) => x.name === cond) ? "active" : ""}
                onClick={() => addCondition(cond)}
              >
                {cond}
              </button>
            ))}
          </div>
        )}
      </div>

      {concentrationPrompt && (
        <div className="button-row concentration-prompt">
          <span>
            🎯 {c.name} takes damage while concentrating on {concentrationPrompt.spell}. CON save DC {concentrationPrompt.dc} to maintain it.
          </span>
          <button
            className="btn-danger"
            onClick={() => { actions.update(c.id, { concentratingOn: undefined }); actions.dismissConcentrationPrompt(); }}
          >
            Broke Concentration
          </button>
          <button className="btn-secondary" onClick={actions.dismissConcentrationPrompt}>Kept It</button>
        </div>
      )}

      <div className="combatant-concentration">
        {c.concentratingOn ? (
          <span className="condition-chip concentration-chip">
            🎯 Concentrating: {c.concentratingOn}
            <button onClick={() => actions.update(c.id, { concentratingOn: undefined })} aria-label={`Clear ${c.name}'s concentration`}>×</button>
          </span>
        ) : openPanel === "concentration" ? (
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
                actions.update(c.id, { concentratingOn: concentrationInput.trim() });
                setConcentrationInput("");
                onOpenPanel(null);
              }}
            >
              Set
            </button>
            <button className="btn-secondary" onClick={() => { onOpenPanel(null); setConcentrationInput(""); }}>Cancel</button>
          </div>
        ) : (
          <button className="btn-secondary condition-toggle" onClick={() => { onOpenPanel("concentration"); setConcentrationInput(""); }}>
            + Concentration
          </button>
        )}
      </div>

      {onBattleMap && (
        <div className="combatant-light">
          {c.lightRadiusFeet ? (
            <span className="condition-chip light-chip">
              🔥 Light {c.lightRadiusFeet} ft
              <button onClick={() => actions.update(c.id, { lightRadiusFeet: undefined })} aria-label={`Clear ${c.name}'s carried light`}>×</button>
            </span>
          ) : openPanel === "light" ? (
            <div className="condition-picker">
              {LIGHT_PRESETS.map((p) => (
                <button key={p.label} className="btn-secondary" onClick={() => { actions.update(c.id, { lightRadiusFeet: p.feet }); onOpenPanel(null); }}>
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
                  actions.update(c.id, { lightRadiusFeet: feet });
                  setLightInput("");
                  onOpenPanel(null);
                }}
              >
                Set
              </button>
              <button className="btn-secondary" onClick={() => { onOpenPanel(null); setLightInput(""); }}>Cancel</button>
            </div>
          ) : (
            <button className="btn-secondary condition-toggle" onClick={() => { onOpenPanel("light"); setLightInput(""); }}>
              + Carried Light
            </button>
          )}
        </div>
      )}

      {onBattleMap && (
        <label className="condition-toggle">
          <input
            type="checkbox"
            checked={!!c.flying}
            onChange={(e) => actions.update(c.id, { flying: e.target.checked })}
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
              onClick={() => actions.spendLegendaryAction(c.id, a.cost)}
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
          onChange={(e) => actions.update(c.id, { notes: e.target.value })}
          placeholder="other notes…"
        />
      </div>

      {hazard && (
        <div className="button-row">
          <span>⚠ In hazard zone: {hazard.label}</span>
          <button className="btn-danger" onClick={() => actions.adjustHp(c.id, -hazard.damage)}>
            Apply Hazard (-{hazard.damage} hp)
          </button>
        </div>
      )}

      <div className="combatant-hp">
        <span className="combatant-hp-value mono">{currentHp} / {c.maxHp ?? 0} HP</span>
        <HpBar current={currentHp} max={c.maxHp ?? 0} />
        <input
          type="number"
          className="combatant-hp-input"
          value={hpAmount}
          onChange={(e) => setHpAmount(e.target.value)}
          placeholder="amount"
          aria-label={`HP change amount for ${c.name}`}
        />
        <button className="btn-danger" onClick={() => applyDelta(-1)}>Damage</button>
        <button className="btn-secondary" onClick={() => applyDelta(1)}>Heal</button>
        <button className="btn-secondary" onClick={() => actions.rest(c.id)} aria-label={`Rest ${c.name}`}>Rest</button>
        {partyMode && (
          <button className="btn-secondary" onClick={() => actions.update(c.id, { hpVisible: !c.hpVisible })} aria-pressed={c.hpVisible}>
            {c.hpVisible ? "Hide HP" : "Show HP"}
          </button>
        )}
        {partyMode && (
          <button className="btn-secondary" onClick={() => actions.update(c.id, { hidden: !c.hidden })} aria-pressed={!!c.hidden}>
            {c.hidden ? "Reveal on Map" : "Hide from Map"}
          </button>
        )}
        {partyMode && c.kind !== "playerCharacter" && currentHp <= 0 && (
          <button className="btn-secondary" aria-expanded={openPanel === "loot"} onClick={() => toggle("loot")}>
            💰 Add Loot
          </button>
        )}
      </div>

      {openPanel === "loot" && (
        <LootPanel
          from={c}
          worldId={partyWorldId}
          defaultAuthorName={lootAuthorName}
          onRecorded={() => onOpenPanel(null)}
        />
      )}
    </li>
  );
}
