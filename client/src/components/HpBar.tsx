export function HpBar({ current, max }: { current: number; max: number }) {
  if (max <= 0) return null;
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const state = pct <= 25 ? "critical" : pct <= 50 ? "low" : "ok";
  return (
    <div className="hp-bar" role="progressbar" aria-valuenow={current} aria-valuemin={0} aria-valuemax={max}>
      <div className={`hp-bar-fill hp-bar-${state}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
