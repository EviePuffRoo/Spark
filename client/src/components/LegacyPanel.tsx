import { useEffect, useState } from "react";
import { ACHIEVEMENTS, type LegacyAchievements } from "@spark/shared";
import { api } from "../api";

// Same achievement grid AchievementsPanel renders, but for the account's
// whole career (every world summed) instead of one world — private to the
// signed-in account, since there's no other worldId to gate here.
export function LegacyPanel() {
  const [data, setData] = useState<LegacyAchievements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getLegacyAchievements()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const progressById = new Map((data?.progress ?? []).map((p) => [p.id, p]));

  return (
    <>
      <h3 className="section-heading">
        Legacy{data && <span className="achievements-count"> · {data.unlockedCount}/{data.totalCount}</span>}
      </h3>
      <div className="save-panel">
        <p className="hint">
          {data
            ? `Your career across ${data.worldCount} world${data.worldCount === 1 ? "" : "s"} — every table you've owned or joined, summed.`
            : "Your career across every world you've owned or joined, summed."}
        </p>
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
    </>
  );
}
