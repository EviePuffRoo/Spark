import { useAuth } from "../AuthContext";
import type { TimelineEntry } from "../campaignTimeline";
import type { WorldSummary } from "../api";

const KIND_LABELS: Record<TimelineEntry["kind"], string> = {
  note: "Note",
  quest: "Quest",
  adventure: "Adventure",
  campaignEvent: "World Event",
};

function formatDate(entry: TimelineEntry): string {
  // A bare "YYYY-MM-DD" (a note's sessionDate) is read as UTC to avoid a
  // local-timezone off-by-one; full ISO timestamps use the local zone.
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(entry.date);
  return isDateOnly
    ? new Date(entry.date).toLocaleDateString(undefined, { timeZone: "UTC" })
    : new Date(entry.date).toLocaleDateString();
}

export function SessionTimelineView({
  entries, worlds, worldFilter, onWorldFilterChange, onSelectEntry, onOpenInRoster,
}: {
  entries: TimelineEntry[];
  worlds: WorldSummary[];
  worldFilter: string;
  onWorldFilterChange: (worldId: string) => void;
  onSelectEntry: (entry: TimelineEntry) => void;
  onOpenInRoster: (type: NonNullable<TimelineEntry["entityType"]>, id: string) => void;
}) {
  const { user } = useAuth();

  return (
    <div className="panel session-timeline">
      <h2>Campaign Timeline</h2>
      <p className="hint">Your campaign's story so far, oldest to newest — session notes, quests, adventures, and world events together.</p>

      {worlds.length > 0 && (
        <label className="field">
          <span>Filter by world</span>
          <select value={worldFilter} onChange={(e) => onWorldFilterChange(e.target.value)}>
            <option value="">All</option>
            {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
      )}

      {entries.length === 0 && <p className="hint">Nothing to show yet.</p>}

      <ul className="timeline-list">
        {entries.map((entry) => {
          const isOwn = entry.userId === user?.id;
          const ownerUsername = !isOwn ? worlds.find((w) => w.id === entry.worldId)?.ownerUsername : undefined;
          const content = (
            <>
              <span className="timeline-date">
                <span className={`condition-chip timeline-kind-chip timeline-kind-${entry.kind}`}>{KIND_LABELS[entry.kind]}</span>
                {" "}{formatDate(entry)}{entry.meta ? ` · ${entry.meta}` : ""}
                {ownerUsername && ` · recapped by ${ownerUsername}`}
              </span>
              <span className="entity-name">{entry.title}</span>
              <span className="timeline-summary">{entry.summary}</span>
            </>
          );
          const clickable = entry.kind === "note" ? isOwn : entry.kind !== "campaignEvent";
          return (
            <li key={entry.id} className="timeline-entry">
              {clickable ? (
                <button
                  className="timeline-entry-button"
                  onClick={() => (entry.kind === "note" ? onSelectEntry(entry) : onOpenInRoster(entry.entityType!, entry.entityId!))}
                >
                  {content}
                </button>
              ) : (
                <div className="timeline-entry-button timeline-entry-readonly">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
