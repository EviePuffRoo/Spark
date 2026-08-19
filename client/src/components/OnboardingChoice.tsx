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
          Build your world, then run it live — encounters, dice, HP, and party chat sync to every
          player's phone as you play. Nothing here is AI-generated, and real-time sync is free, not
          a paid feature.
        </p>
        <p className="hint">
          When you're ready to run a session, the <strong>Play</strong> tab is where combat, dice,
          and party chat happen live at the table.
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
          <p className="hint">Jump straight to building your own — you can load the sample world later from the Worlds tab.</p>
        </div>
      </div>
    </div>
  );
}
