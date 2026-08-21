import { useEffect, useState } from "react";
import type { BaseState } from "@spark/shared";
import { api } from "../api";
import { useActiveWorld } from "../ActiveWorldContext";
import { BaseMapIcon } from "../components/icons";
import { BaseMapView } from "../components/BaseMapView";
import { EmptyState } from "../components/EmptyState";

export function BaseMapPage({ onNavigateToTavern }: { onNavigateToTavern: () => void }) {
  const { worlds, worldId, setWorldId } = useActiveWorld();
  const [data, setData] = useState<BaseState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!worldId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    api.getBase(worldId)
      .then(setData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [worldId]);

  return (
    <div className="page">
      <div className="panel">
        <div className="page-title">
          <BaseMapIcon className="page-title-icon" aria-hidden="true" />
          <h2>Base Map</h2>
        </div>
        <p className="hint">A living map of the party's outpost — it grows as you invest in it. Click a structure for details.</p>

        {worlds.length === 0 ? (
          <p className="hint">Create or join a world to see its base.</p>
        ) : (
          <label className="field">
            <span>World</span>
            <select value={worldId} onChange={(e) => setWorldId(e.target.value)}>
              <option value="">Select a world…</option>
              {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
        )}
      </div>

      {!worldId && (
        <div className="panel">
          <EmptyState icon={<BaseMapIcon />} heading="No world selected" hint="Select a world above to see its base map." />
        </div>
      )}

      {worldId && loading && <div className="panel"><p className="hint">Loading…</p></div>}
      {worldId && error && <div className="panel"><p className="error">{error}</p></div>}

      {worldId && data && (
        <div className="panel">
          <h3 className="section-heading">{data.name} — Level {data.level}</h3>
          <p className="hint">Defense Rating {data.defenseRating} · {data.gold} gp available.</p>
          <BaseMapView base={data} />
          <button className="btn-secondary" onClick={onNavigateToTavern}>Manage Upgrades</button>
        </div>
      )}
    </div>
  );
}
