import type { PlayerCharacterInput, AbilityKey } from "@spark/shared";

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

export function PlayerCharacterCardView({ pc }: { pc: PlayerCharacterInput }) {
  return (
    <div className="statblock item-card">
      <h2 className="statblock-name">{pc.name}</h2>
      <p className="statblock-subtitle">
        Level {pc.level} {pc.race} {pc.className}
        {pc.playerName ? ` · played by ${pc.playerName}` : ""}
      </p>
      <hr className="rule gold" />
      <p><strong>Armor Class</strong> {pc.armorClass}</p>
      <p><strong>Max HP</strong> {pc.maxHp}</p>
      <hr className="rule" />
      <div className="ability-grid">
        {ABILITY_ORDER.map(({ key, label }) => (
          <div key={key} className="ability">
            <div className="ability-label">{label}</div>
            <div className="ability-score">{pc.abilityScores[key]} ({modifier(pc.abilityScores[key])})</div>
          </div>
        ))}
      </div>
    </div>
  );
}
