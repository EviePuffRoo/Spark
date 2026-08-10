import type { SpellSlotLevel } from "@spark/shared";

const LEVEL_LABELS: Record<number, string> = {
  1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th",
  6: "6th", 7: "7th", 8: "8th", 9: "9th",
};

export function SpellSlotsPanel({
  spellSlots, onChange,
}: {
  spellSlots: SpellSlotLevel[];
  onChange?: (spellSlots: SpellSlotLevel[]) => void;
}) {
  if (spellSlots.length === 0) return null;

  function setCurrent(level: number, current: number) {
    onChange?.(spellSlots.map((s) => (s.level === level ? { ...s, current: Math.max(0, Math.min(s.max, current)) } : s)));
  }

  return (
    <div className="spell-slots-panel">
      <h3 className="section-heading">Spell Slots</h3>
      <div className="spell-slots-row">
        {spellSlots.map((s) => (
          <label className="field spell-slot-field" key={s.level}>
            <span>{LEVEL_LABELS[s.level] ?? s.level}</span>
            {onChange ? (
              <input
                type="number" min={0} max={s.max} value={s.current}
                onChange={(e) => setCurrent(s.level, Number(e.target.value))}
              />
            ) : (
              <span>{s.current} / {s.max}</span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
