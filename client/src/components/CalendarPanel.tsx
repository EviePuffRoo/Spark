import { useState } from "react";
import { describeCalendarDay } from "@spark/shared";
import { api, type WorldSummary } from "../api";

export function CalendarPanel({ world, onUpdated }: { world: WorldSummary; onUpdated: () => void }) {
  const [customDays, setCustomDays] = useState("1");
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const date = describeCalendarDay(world.currentDay);

  if (!world.isOwner) {
    return <p className="next-session-line">Today: <strong>{date.label}</strong></p>;
  }

  async function advance(days: number) {
    if (!Number.isInteger(days) || days < 1) return;
    setAdvancing(true);
    setError(null);
    try {
      await api.advanceWorldDay(world.id, days);
      onUpdated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <p className="next-session-line">
      Today: <strong>{date.label}</strong>
      {" "}
      <button className="link-button" onClick={() => advance(1)} disabled={advancing}>+1 Day</button>
      {" "}
      <input
        type="number" min={1} className="calendar-days-input"
        value={customDays} onChange={(e) => setCustomDays(e.target.value)}
      />
      <button className="link-button" onClick={() => advance(Number(customDays))} disabled={advancing}>Advance</button>
      {error && <span className="error"> {error}</span>}
    </p>
  );
}
