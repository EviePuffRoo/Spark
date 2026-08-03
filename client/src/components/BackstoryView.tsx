import type { Backstory } from "@spark/shared";

const FIELDS: { key: keyof Backstory; label: string }[] = [
  { key: "occupationOrRole", label: "Role" },
  { key: "appearance", label: "Appearance" },
  { key: "personalityTrait", label: "Personality" },
  { key: "mannerism", label: "Mannerism" },
  { key: "ideal", label: "Ideal" },
  { key: "bond", label: "Bond" },
  { key: "flaw", label: "Flaw" },
  { key: "motivation", label: "Motivation" },
  { key: "secret", label: "Secret" },
];

export function BackstoryView({ backstory }: { backstory: Backstory }) {
  return (
    <div className="backstory">
      <h3 className="section-heading">Backstory</h3>
      <dl>
        {FIELDS.filter(({ key }) => backstory[key]).map(({ key, label }) => (
          <div className="backstory-row" key={key}>
            <dt>{label}</dt>
            <dd>{backstory[key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
