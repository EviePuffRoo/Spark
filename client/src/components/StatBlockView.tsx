import type { AbilityKey, StatBlock } from "@spark/shared";

const ABILITY_ORDER: { key: AbilityKey; label: string }[] = [
  { key: "str", label: "STR" },
  { key: "dex", label: "DEX" },
  { key: "con", label: "CON" },
  { key: "int", label: "INT" },
  { key: "wis", label: "WIS" },
  { key: "cha", label: "CHA" },
];

function modifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function StatBlockView({ name, subtitle, statBlock }: { name: string; subtitle: string; statBlock: StatBlock }) {
  return (
    <div className="statblock">
      <h2 className="statblock-name">{name}</h2>
      <p className="statblock-subtitle">{subtitle}</p>
      <hr className="rule gold" />
      <p><strong>Armor Class</strong> {statBlock.armorClass}{statBlock.armorClassNote ? ` (${statBlock.armorClassNote})` : ""}</p>
      <p><strong>Hit Points</strong> {statBlock.hitPointsAverage} ({statBlock.hitDiceFormula})</p>
      <p><strong>Speed</strong> {statBlock.speed}</p>
      <hr className="rule" />
      <div className="ability-grid">
        {ABILITY_ORDER.map(({ key, label }) => (
          <div key={key} className="ability">
            <div className="ability-label">{label}</div>
            <div className="ability-score mono">{statBlock.abilityScores[key]} ({modifier(statBlock.abilityScores[key])})</div>
          </div>
        ))}
      </div>
      <hr className="rule" />
      {statBlock.savingThrows && <p><strong>Saving Throws</strong> {statBlock.savingThrows}</p>}
      {statBlock.skills && <p><strong>Skills</strong> {statBlock.skills}</p>}
      {statBlock.damageResistances && <p><strong>Damage Resistances</strong> {statBlock.damageResistances}</p>}
      {statBlock.damageImmunities && <p><strong>Damage Immunities</strong> {statBlock.damageImmunities}</p>}
      {statBlock.conditionImmunities && <p><strong>Condition Immunities</strong> {statBlock.conditionImmunities}</p>}
      <p><strong>Senses</strong> {statBlock.senses}</p>
      <p><strong>Languages</strong> {statBlock.languages}</p>
      <p><strong>Challenge</strong> {statBlock.challengeRating} ({statBlock.xp} XP) &nbsp; <strong>Prof. Bonus</strong> +{statBlock.proficiencyBonus}</p>
      {statBlock.traits.length > 0 && (
        <>
          <hr className="rule" />
          {statBlock.traits.map((trait) => (
            <p key={trait.name}><em><strong>{trait.name}.</strong></em> {trait.description}</p>
          ))}
        </>
      )}
      {statBlock.actions.length > 0 && (
        <>
          <h3 className="section-heading">Actions</h3>
          {statBlock.actions.map((action) => (
            <p key={action.name}><em><strong>{action.name}.</strong></em> {action.description}</p>
          ))}
        </>
      )}
      {statBlock.reactions && statBlock.reactions.length > 0 && (
        <>
          <h3 className="section-heading">Reactions</h3>
          {statBlock.reactions.map((reaction) => (
            <p key={reaction.name}><em><strong>{reaction.name}.</strong></em> {reaction.description}</p>
          ))}
        </>
      )}
    </div>
  );
}
