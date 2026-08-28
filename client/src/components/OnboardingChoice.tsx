import { useState } from "react";
import { api } from "../api";
import { useActiveWorld } from "../ActiveWorldContext";

export function OnboardingChoice({ onDone }: { onDone: (landOnOverview: boolean) => void }) {
  const { setWorldId } = useActiveWorld();
  const [loadingStarter, setLoadingStarter] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLoadStarter() {
    if (loadingStarter) return;
    setLoadingStarter(true);
    setError(null);
    try {
      const { worldId } = await api.createStarterWorld();
      setWorldId(worldId);
      onDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingStarter(false);
    }
  }

  return (
    <div className="page auth-page">
      <div className="panel auth-panel">
        <h1>Welcome to Spark</h1>
        <p className="hint">
          Nothing here is AI-generated, and real-time sync is free, not a paid feature. The app is
          split into four areas: <strong>Prep</strong> to generate and write NPCs, items, locations
          and more; <strong>World</strong> to organize what you've made into a campaign and track
          its story; <strong>Play</strong> for live combat, dice, and party chat at the table; and{" "}
          <strong>Account</strong> for your profile, billing, and the public Gallery.
        </p>

        {error && <p className="error">{error}</p>}

        <div className="save-panel">
          <button className="btn-primary" onClick={handleLoadStarter} disabled={loadingStarter}>
            {loadingStarter ? "Loading…" : "Start with a sample world"}
          </button>
          <p className="hint">A ready-made world with NPCs, locations, a quest, and a dungeon to explore.</p>
        </div>

        <div className="save-panel">
          <button className="btn-secondary" onClick={() => onDone(false)}>Start from a blank slate</button>
          <p className="hint">Jump straight to building your own. You can load the sample world later from the Worlds tab.</p>
        </div>
      </div>
    </div>
  );
}
