import { useEffect, useState } from "react";
import type { ModerationQueueEntry } from "@spark/shared";
import { api } from "../api";

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  offensive: "Offensive content",
  copyright: "Copyright / IP concern",
  other: "Other",
};

export function ModerationPage() {
  const [entries, setEntries] = useState<ModerationQueueEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    api.listModerationQueue({ status: "pending" })
      .then((r) => { setEntries(r.entries); setNextCursor(r.nextCursor); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function loadMore() {
    if (!nextCursor) return;
    try {
      const r = await api.listModerationQueue({ status: "pending", cursor: nextCursor });
      setEntries((prev) => [...prev, ...r.entries]);
      setNextCursor(r.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const selected = entries.find((e) => e.id === selectedId) ?? null;

  async function handleDismiss(reportId: string) {
    setActionStatus(null);
    try {
      await api.dismissReport(reportId);
      setActionStatus("Report dismissed.");
      refresh();
    } catch (e) {
      setActionStatus((e as Error).message);
    }
  }

  async function handleRemoveEntry() {
    if (!selected || !removeReason.trim()) return;
    setActionStatus(null);
    try {
      await api.removeGalleryEntry(selected.id, removeReason.trim());
      setActionStatus("Entry removed from the gallery.");
      setSelectedId(null);
      setRemoveReason("");
      refresh();
    } catch (e) {
      setActionStatus((e as Error).message);
    }
  }

  async function handleSuspend() {
    if (!selected) return;
    setActionStatus(null);
    try {
      await api.suspendPublishing(selected.publisherId);
      setActionStatus(`${selected.publisherUsername}'s publishing access has been suspended.`);
    } catch (e) {
      setActionStatus((e as Error).message);
    }
  }

  async function handleRestore() {
    if (!selected) return;
    setActionStatus(null);
    try {
      await api.restorePublishing(selected.publisherId);
      setActionStatus(`${selected.publisherUsername}'s publishing access has been restored.`);
    } catch (e) {
      setActionStatus((e as Error).message);
    }
  }

  return (
    <div className="page">
      <div className="generator-layout">
        <div className="panel">
          <h2>Gallery Moderation</h2>
          <p className="hint">Published entries with at least one pending report.</p>

          {error && <p className="error">{error}</p>}
          {loading ? (
            <p className="hint">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="hint">Nothing to review.</p>
          ) : (
            <ul className="entity-list">
              {entries.map((e) => (
                <li key={e.id}>
                  <button
                    className={`entity-item ${e.id === selectedId ? "active" : ""}`}
                    onClick={() => { setSelectedId(e.id); setRemoveReason(""); setActionStatus(null); }}
                  >
                    <span className="entity-name">{e.name || e.title}</span>
                    <span className="entity-meta">
                      {e.reportCount} report{e.reportCount === 1 ? "" : "s"} · by {e.publisherUsername}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!loading && nextCursor && (
            <button className="btn-secondary" onClick={loadMore}>Load More</button>
          )}
        </div>

        <div className="panel result-panel">
          {!selected && <p className="hint">Select an entry to review it.</p>}
          {selected && (
            <>
              <p className="entity-meta">
                "{selected.title}", published by {selected.publisherUsername} on {new Date(selected.publishedAt).toLocaleDateString()}
              </p>

              <h3 className="section-heading">Reports</h3>
              <ul className="entity-list">
                {selected.reports.map((r) => (
                  <li key={r.id} className="save-panel">
                    <p><strong>{REASON_LABELS[r.reason] ?? r.reason}</strong>, reported by {r.reporterUsername}</p>
                    {r.detail && <p className="hint">{r.detail}</p>}
                    <button className="btn-secondary" onClick={() => handleDismiss(r.id)}>Dismiss this report</button>
                  </li>
                ))}
              </ul>

              <h3 className="section-heading">Actions</h3>
              <div className="save-panel">
                <label className="field">
                  <span>Removal reason</span>
                  <textarea value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} rows={2} />
                </label>
                <div className="button-row">
                  <button className="btn-primary" onClick={handleRemoveEntry} disabled={!removeReason.trim()}>
                    Remove entry from gallery
                  </button>
                  <button className="btn-secondary" onClick={handleSuspend}>Suspend publisher</button>
                  <button className="btn-secondary" onClick={handleRestore}>Restore publisher</button>
                </div>
              </div>
            </>
          )}
          {/* Outside the `selected` block on purpose — removing an entry
              clears selectedId (its row is gone from the queue), which
              would otherwise unmount this message before it's ever seen. */}
          {actionStatus && <p className="success">{actionStatus}</p>}
        </div>
      </div>
    </div>
  );
}
