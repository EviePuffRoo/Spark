import type { DeathSaves } from "@spark/shared";

export function DeathSavesPanel({
  deathSaves, onChange,
}: {
  deathSaves: DeathSaves;
  onChange?: (deathSaves: DeathSaves) => void;
}) {
  function setCount(kind: "successes" | "failures", count: number) {
    onChange?.({ ...deathSaves, [kind]: Math.max(0, Math.min(3, count)) });
  }

  function toggle(kind: "successes" | "failures", index: number) {
    if (!onChange) return;
    const current = deathSaves[kind];
    setCount(kind, index < current ? index : index + 1);
  }

  return (
    <div className="death-saves-panel">
      <h3 className="section-heading">Death Saves</h3>
      <div className="death-saves-row">
        <span>Successes</span>
        {[0, 1, 2].map((i) => (
          <input
            key={i} type="checkbox" checked={i < deathSaves.successes}
            disabled={!onChange} onChange={() => toggle("successes", i)}
            aria-label={`Success ${i + 1}`}
          />
        ))}
      </div>
      <div className="death-saves-row">
        <span>Failures</span>
        {[0, 1, 2].map((i) => (
          <input
            key={i} type="checkbox" checked={i < deathSaves.failures}
            disabled={!onChange} onChange={() => toggle("failures", i)}
            aria-label={`Failure ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
