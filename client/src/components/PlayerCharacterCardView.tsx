import type { PlayerCharacterInput, PlayerCharacter, AbilityKey } from "@spark/shared";

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

type LivingStateProps = Partial<Pick<PlayerCharacter, "currentHp" | "deathSaves" | "spellSlots" | "preparedSpells" | "classResources">>;

export function PlayerCharacterCardView({ pc }: { pc: PlayerCharacterInput & LivingStateProps }) {
  return (
    <div className="statblock item-card">
      <h2 className="statblock-name">{pc.name}</h2>
      <p className="statblock-subtitle">
        Level {pc.level} {pc.race} {pc.className}
        {pc.playerName ? ` · played by ${pc.playerName}` : ""}
      </p>
      <hr className="rule gold" />
      <p><strong>Armor Class</strong> {pc.armorClass}</p>
      <p><strong>Hit Points</strong> {pc.currentHp !== undefined ? `${pc.currentHp} / ${pc.maxHp}` : pc.maxHp}</p>
      {pc.deathSaves && (pc.deathSaves.successes > 0 || pc.deathSaves.failures > 0) && (
        <p><strong>Death Saves</strong> {pc.deathSaves.successes} successes, {pc.deathSaves.failures} failures</p>
      )}
      <hr className="rule" />
      <div className="ability-grid">
        {ABILITY_ORDER.map(({ key, label }) => (
          <div key={key} className="ability">
            <div className="ability-label">{label}</div>
            <div className="ability-score">{pc.abilityScores[key]} ({modifier(pc.abilityScores[key])})</div>
          </div>
        ))}
      </div>
      {pc.spellSlots && pc.spellSlots.length > 0 && (
        <>
          <hr className="rule" />
          <p><strong>Spell Slots</strong> {pc.spellSlots.map((s) => `${s.current}/${s.max} (L${s.level})`).join(", ")}</p>
        </>
      )}
      {pc.classResources && pc.classResources.length > 0 && (
        <p><strong>{pc.classResources[0].name}</strong> {pc.classResources[0].current} / {pc.classResources[0].max}</p>
      )}
      {pc.preparedSpells && pc.preparedSpells.length > 0 && (
        <p><strong>Prepared Spells</strong> {pc.preparedSpells.length}</p>
      )}
    </div>
  );
}
