import { useLocalStorage } from "../useLocalStorage";

// Shown once to a player who's just landed on the mobile companion view
// (via a join code, QR, or the "Player View" link) with no orientation of
// what they're looking at — same dismiss-once convention as WelcomePanel.
export function CompanionWelcomePanel() {
  const [dismissed, setDismissed] = useLocalStorage("spark-companion-welcome-dismissed", false);

  if (dismissed) return null;

  return (
    <div className="panel">
      <p className="hint">
        This is your table view for live sessions: turn order, dice, party chat, and your
        character sheet, all synced in real time. Your DM's changes show up here automatically.
      </p>
      <button className="link-button" onClick={() => setDismissed(true)}>Got it</button>
    </div>
  );
}
