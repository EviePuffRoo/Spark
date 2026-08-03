import { useState } from "react";

const STORAGE_KEY = "spark-welcome-dismissed";

export function WelcomePanel() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");

  if (dismissed) return null;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  }

  return (
    <div className="panel welcome-panel">
      <h2>Welcome to Spark</h2>
      <p>
        Generate an NPC, item, location, quest hook, faction, or encounter table from the tabs below —
        or write your own from scratch with "Create Your Own". Save what you like to your{" "}
        <strong>Roster</strong>, tag it, then group things into <strong>Worlds</strong> as your campaigns take shape.
      </p>
      <button className="btn-secondary" onClick={dismiss}>Got it, don't show this again</button>
    </div>
  );
}
