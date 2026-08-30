import type { PlayerCharacter } from "@spark/shared";
import { SKILLS, SPELLS, getRuleset } from "@spark/shared";
import { PlayerCharacterCardView } from "./PlayerCharacterCardView";
import { EquipmentPanel } from "./EquipmentPanel";

const abilityModifier = getRuleset().abilityModifier;

function formatBonus(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

// The full printable sheet — everything PlayerCharacterCardView summarizes
// (spell slot totals, prepared-spell count, one class resource) is spelled
// out in full here instead, since a printout is meant to be read away from
// the app rather than alongside a "click through for detail" UI.
export function PlayerCharacterPrintSheet({ pc }: { pc: PlayerCharacter }) {
  const skillEntries = (pc.skillProficiencies ?? [])
    .map((name) => SKILLS.find((s) => s.name === name))
    .filter((s): s is (typeof SKILLS)[number] => !!s);

  const spellEntries = (pc.preparedSpells ?? [])
    .map((id) => SPELLS.find((s) => s.id === id))
    .filter((s): s is (typeof SPELLS)[number] => !!s)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  return (
    <div className="print-character-sheet">
      <PlayerCharacterCardView pc={pc} />

      {skillEntries.length > 0 && (
        <div className="statblock">
          <h3 className="section-heading">Skill Proficiencies</h3>
          <ul className="print-detail-list">
            {skillEntries.map((s) => (
              <li key={s.name}>
                {s.name} ({s.ability.toUpperCase()}) {formatBonus(abilityModifier(pc.abilityScores[s.ability]) + (pc.proficiencyBonus ?? 0))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {spellEntries.length > 0 && (
        <div className="statblock">
          <h3 className="section-heading">Prepared Spells</h3>
          <ul className="print-detail-list">
            {spellEntries.map((s) => (
              <li key={s.id}>
                {s.name} <span className="entity-meta">({s.level === 0 ? "Cantrip" : `Level ${s.level}`} · {s.school})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pc.classResources && pc.classResources.length > 0 && (
        <div className="statblock">
          <h3 className="section-heading">Class Resources</h3>
          <ul className="print-detail-list">
            {pc.classResources.map((r) => (
              <li key={r.name}>{r.name}: {r.current} / {r.max}</li>
            ))}
          </ul>
        </div>
      )}

      <EquipmentPanel
        equippedItems={pc.equippedItems}
        attunedItems={pc.attunedItems}
        baseArmorClass={pc.armorClass}
        strengthScore={pc.abilityScores.str}
      />
    </div>
  );
}
