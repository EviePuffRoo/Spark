import { useEffect, useRef } from "react";

const REMINDER_WINDOW_MS = 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Fires an in-tab browser notification once, the first time the current
// moment lands within an hour of the scheduled next-session time. Mirrors
// useMyTurnNotifier's approach — no push infrastructure exists in this app,
// so this only works while the tab is open, which is why it's opt-in rather
// than assumed. A ref (not localStorage) tracks which timestamp it already
// notified for, so re-scheduling the session to a new time re-arms it.
export function useSessionReminder(nextSessionAt: string | undefined, enabled: boolean) {
  const notifiedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !nextSessionAt) return;

    function check() {
      const msUntil = new Date(nextSessionAt!).getTime() - Date.now();
      const alreadyNotified = notifiedForRef.current === nextSessionAt;
      if (alreadyNotified || msUntil > REMINDER_WINDOW_MS || msUntil < -REMINDER_WINDOW_MS) return;

      notifiedForRef.current = nextSessionAt!;
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Session starting soon", {
          body: `Your next session is at ${new Date(nextSessionAt!).toLocaleString()}`,
        });
      }
    }

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [nextSessionAt, enabled]);
}
