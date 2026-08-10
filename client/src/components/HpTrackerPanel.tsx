import { useState } from "react";

export function HpTrackerPanel({
  currentHp, maxHp, onChange,
}: {
  currentHp: number;
  maxHp: number;
  onChange?: (hp: number) => void;
}) {
  const [delta, setDelta] = useState(1);

  function apply(sign: 1 | -1) {
    const next = Math.max(0, Math.min(maxHp, currentHp + sign * delta));
    onChange?.(next);
  }

  return (
    <div className="hp-tracker-panel">
      <h3 className="section-heading">Hit Points</h3>
      <p className="hp-tracker-value">{currentHp} / {maxHp}</p>
      {onChange && (
        <div className="button-row">
          <button className="btn-secondary" onClick={() => apply(-1)}>− Damage</button>
          <input
            type="number" min={1} value={delta}
            onChange={(e) => setDelta(Math.max(1, Number(e.target.value)))}
            style={{ width: "70px" }}
          />
          <button className="btn-secondary" onClick={() => apply(1)}>+ Heal</button>
        </div>
      )}
    </div>
  );
}
