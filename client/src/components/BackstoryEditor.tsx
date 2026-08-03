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

export function BackstoryEditor({ value, onChange }: { value: Backstory; onChange: (next: Backstory) => void }) {
  return (
    <div className="backstory-editor">
      {FIELDS.map(({ key, label }) => (
        <label className="field" key={key}>
          <span>{label}</span>
          <textarea
            rows={2}
            value={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          />
        </label>
      ))}
    </div>
  );
}
