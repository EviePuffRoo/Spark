import { useEffect, useState } from "react";
import type { CampaignEventLogEntry } from "@spark/shared";
import { api } from "../api";
import { timeAgo } from "./DiceRoller";

// Renders one entry from the unified activity feed (CampaignEventLog) as
// a single readable line — a switch on eventType, not on entityType,
// since eventType is the more specific/stable key (see the type's own
// comment in shared/src/types.ts for why payload shape varies by it).
function describeEntry(entry: CampaignEventLogEntry): string {
  const p = entry.payload as Record<string, unknown>;
  const delta = typeof p.delta === "number" ? p.delta : 0;
  const sign = delta > 0 ? "+" : "";
  const reason = typeof p.reason === "string" && p.reason ? ` — ${p.reason}` : "";

  switch (entry.eventType) {
    case "disposition.adjusted": {
      const name = typeof p.characterName === "string" ? p.characterName : "An NPC";
      return `${name}: ${sign}${delta} disposition${reason}`;
    }
    case "disposition.adjustedForPc": {
      const name = typeof p.characterName === "string" ? p.characterName : "An NPC";
      return `${name}: ${sign}${delta} standing with one PC${reason}`;
    }
    case "faction.reputationChanged": {
      const name = typeof p.factionName === "string" ? p.factionName : "A faction";
      return `${name}: ${sign}${delta} reputation${reason}`;
    }
    case "campaignEvent.logged": {
      const title = typeof p.title === "string" ? p.title : "A campaign event";
      return title;
    }
    case "worldTick.applied": {
      const fromDay = typeof p.fromDay === "number" ? p.fromDay : "?";
      const toDay = typeof p.toDay === "number" ? p.toDay : "?";
      const itemCount = typeof p.itemCount === "number" ? p.itemCount : 0;
      return `World Tick: day ${fromDay} → ${toDay} (${itemCount} change${itemCount === 1 ? "" : "s"})`;
    }
    default:
      return entry.eventType;
  }
}

export function WorldActivityPanel({ worldId, refreshKey }: { worldId: string; refreshKey?: number }) {
  const [entries, setEntries] = useState<CampaignEventLogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.listCampaignEventLog(worldId)
      .then((r) => { if (!cancelled) { setEntries(r.entries); setNextCursor(r.nextCursor); } })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [worldId, refreshKey]);

  async function loadMore() {
    if (!nextCursor) return;
    try {
      const r = await api.listCampaignEventLog(worldId, nextCursor);
      setEntries((prev) => [...prev, ...r.entries]);
      setNextCursor(r.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="panel">
      <h3 className="section-heading">World Activity</h3>
      <p className="hint">Disposition, reputation, and world events together, newest first — pulled from every NPC and faction at once.</p>
      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="hint">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="hint">Nothing logged yet for this world.</p>
      ) : (
        <ul className="dice-history">
          {entries.map((entry) => (
            <li key={entry.id} className="dice-history-row">
              <div className="dice-history-main">
                <span>{describeEntry(entry)}</span>
                <span className="dice-history-time">{timeAgo(new Date(entry.createdAt).getTime())}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!loading && nextCursor && (
        <button className="btn-secondary" onClick={loadMore}>Load More</button>
      )}
    </div>
  );
}
