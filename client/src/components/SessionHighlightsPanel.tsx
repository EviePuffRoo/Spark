import { useEffect, useState } from "react";
import type { SessionHighlights, SessionNote } from "@spark/shared";
import { api } from "../api";
import { RecapCard } from "./RecapCard";

const FALLBACK_DAYS_BACK = 7;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SessionHighlightsPanel({ worldId, worldName }: { worldId: string; worldName: string }) {
  const [highlights, setHighlights] = useState<SessionHighlights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setShowCard(false);
    api.listSessionNotes(worldId)
      .then((notes: SessionNote[]) => {
        const latest = notes.length > 0
          ? notes.reduce((a, b) => (new Date(a.sessionDate ?? a.createdAt) > new Date(b.sessionDate ?? b.createdAt) ? a : b))
          : null;
        const since = latest
          ? (latest.sessionDate ?? latest.createdAt)
          : new Date(Date.now() - FALLBACK_DAYS_BACK * 24 * 60 * 60 * 1000).toISOString();
        return api.getSessionHighlights(worldId, since);
      })
      .then((h) => { if (!cancelled) setHighlights(h); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [worldId]);

  const isEmpty = highlights && highlights.rollCount === 0 && highlights.messageCount === 0
    && highlights.goldDelta === 0 && highlights.itemsGained.length === 0;

  return (
    <div className="panel session-highlights-panel">
      <h3 className="section-heading">Since Last Session</h3>
      {loading && <p className="hint">Loading…</p>}
      {error && <p className="error">{error}</p>}
      {highlights && (
        <>
          <p className="hint">Since {formatDate(highlights.since)}: {highlights.rollCount} roll{highlights.rollCount === 1 ? "" : "s"}, {highlights.messageCount} message{highlights.messageCount === 1 ? "" : "s"}.</p>
          {isEmpty && <p className="hint">Nothing notable since last session.</p>}
          {highlights.naturalTwenties.length > 0 && (
            <p><strong>Nat 20s:</strong> {highlights.naturalTwenties.map((r) => `${r.rollerName}${r.label ? ` (${r.label})` : ""}`).join(", ")}</p>
          )}
          {highlights.naturalOnes.length > 0 && (
            <p><strong>Nat 1s:</strong> {highlights.naturalOnes.map((r) => `${r.rollerName}${r.label ? ` (${r.label})` : ""}`).join(", ")}</p>
          )}
          {highlights.topRolls.length > 0 && (
            <p><strong>Biggest rolls:</strong> {highlights.topRolls.map((r) => `${r.rollerName}: ${r.total}`).join(", ")}</p>
          )}
          {highlights.goldDelta !== 0 && (
            <p><strong>Gold:</strong> {highlights.goldDelta > 0 ? "+" : ""}{highlights.goldDelta} gp</p>
          )}
          {highlights.itemsGained.length > 0 && (
            <p><strong>Loot:</strong> {highlights.itemsGained.map((i) => `${i.label} ×${i.quantity}`).join(", ")}</p>
          )}
          {!isEmpty && (
            <button className="btn-secondary" aria-expanded={showCard} onClick={() => setShowCard((v) => !v)}>
              {showCard ? "Hide Recap Card" : "Share as Recap Card"}
            </button>
          )}
          {showCard && <RecapCard highlights={highlights} worldName={worldName} />}
        </>
      )}
    </div>
  );
}
