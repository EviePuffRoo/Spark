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

  function adjust(level: number, sign: 1 | -1) {
    onChange?.(spellSlots.map((s) => (s.level === level ? { ...s, current: Math.max(0, Math.min(s.max, s.current + sign)) } : s)));
  }

  return (
    <div className="spell-slots-panel">
      <h3 className="section-heading">Spell Slots</h3>
      <div className="spell-slots-row">
        {spellSlots.map((s) => (
          <div className="spell-slot-field" key={s.level}>
            <span>{LEVEL_LABELS[s.level] ?? s.level}</span>
            {onChange ? (
              <div className="button-row">
                <button type="button" className="btn-secondary" onClick={() => adjust(s.level, -1)} disabled={s.current <= 0} aria-label={`Use a ${LEVEL_LABELS[s.level] ?? s.level}-level spell slot`}>−</button>
                <span className="spell-slot-value mono">{s.current} / {s.max}</span>
                <button type="button" className="btn-secondary" onClick={() => adjust(s.level, 1)} disabled={s.current >= s.max} aria-label={`Restore a ${LEVEL_LABELS[s.level] ?? s.level}-level spell slot`}>+</button>
              </div>
            ) : (
              <span>{s.current} / {s.max}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
