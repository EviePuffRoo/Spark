import { useEffect, useState } from "react";
import { ACHIEVEMENTS, type WorldAchievements } from "@spark/shared";
import { api } from "../api";

export function AchievementsPanel({ worldId }: { worldId: string }) {
  const [data, setData] = useState<WorldAchievements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getAchievements(worldId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [worldId]);

  const progressById = new Map((data?.progress ?? []).map((p) => [p.id, p]));

  return (
    <div className="panel achievements-panel">
      <h3 className="section-heading">
        Achievements{data && <span className="achievements-count"> · {data.unlockedCount}/{data.totalCount}</span>}
      </h3>
      {loading && <p className="hint">Loading…</p>}
      {error && <p className="error">{error}</p>}
      {data && (
        <ul className="achievements-grid">
          {ACHIEVEMENTS.map((def) => {
            const p = progressById.get(def.id);
            const target = def.target ?? 1;
            const current = p?.current ?? 0;
            const unlocked = p?.unlocked ?? false;
            return (
              <li key={def.id} className={`achievement-badge ${unlocked ? "unlocked" : "locked"}`}>
                <span className="achievement-name">{def.name}</span>
                <span className="achievement-description">{def.description}</span>
                {target > 1 && (
                  <span className="achievement-progress">
                    {unlocked ? "Complete" : `${current}/${target}`}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
