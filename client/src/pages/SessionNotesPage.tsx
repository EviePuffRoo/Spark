import { useEffect, useState } from "react";
import type { SessionNote, QuestHook, Adventure, EntityType } from "@spark/shared";
import { api, type WorldSummary } from "../api";
import { useAuth } from "../AuthContext";
import { useLocalStorage } from "../useLocalStorage";
import { SessionTimelineView } from "../components/SessionTimelineView";
import { SessionPrepView } from "../components/SessionPrepView";
import { buildTimelineEntries } from "../campaignTimeline";
import { NotesIcon } from "../components/icons";
import { EmptyState } from "../components/EmptyState";

const BLANK = {
  title: "",
  sessionLabel: "",
  sessionDate: "",
  summary: "",
  looseThreads: "",
  nextSteps: "",
  worldId: "",
  tags: "",
};

export function SessionNotesPage({ onOpenInRoster }: { onOpenInRoster: (type: EntityType, id: string) => void }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "timeline" | "prep">("list");
  const [prepWorldId, setPrepWorldId] = useLocalStorage("spark-prep-world-id", "");
  const [timelineWorldFilter, setTimelineWorldFilter] = useState("");
  const [timelineQuests, setTimelineQuests] = useState<QuestHook[]>([]);
  const [timelineAdventures, setTimelineAdventures] = useState<Adventure[]>([]);

  function refresh() {
    api.listSessionNotes().then(setNotes).catch((e) => setError(e.message)).finally(() => setLoading(false));
    api.listWorlds().then(setWorlds).catch(() => {});
  }

  useEffect(refresh, []);

  useEffect(() => {
    if (viewMode !== "timeline" || !timelineWorldFilter) {
      setTimelineQuests([]);
      setTimelineAdventures([]);
      return;
    }
    api.listQuests(timelineWorldFilter).then(setTimelineQuests).catch(() => {});
    api.listAdventures(timelineWorldFilter).then(setTimelineAdventures).catch(() => {});
  }, [viewMode, timelineWorldFilter]);

  function startNew() {
    setEditingId(null);
    setForm(BLANK);
  }

  function startEdit(note: SessionNote) {
    setEditingId(note.id);
    setForm({
      title: note.title,
      sessionLabel: note.sessionLabel ?? "",
      sessionDate: note.sessionDate ?? "",
      summary: note.summary,
      looseThreads: note.looseThreads ?? "",
      nextSteps: note.nextSteps ?? "",
      worldId: note.worldId ?? "",
      tags: note.tags.join(", "),
    });
  }

  function openInEditor(note: SessionNote) {
    startEdit(note);
    setViewMode("list");
  }

  async function handleSave() {
    if (!form.title.trim() || !form.summary.trim()) {
      setError("Title and summary are required.");
      return;
    }
    setStatus("saving");
    setError(null);
    const payload = {
      title: form.title.trim(),
      sessionLabel: form.sessionLabel.trim() || undefined,
      sessionDate: form.sessionDate || undefined,
      summary: form.summary.trim(),
      looseThreads: form.looseThreads.trim() || undefined,
      nextSteps: form.nextSteps.trim() || undefined,
      worldId: form.worldId || null,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    try {
      if (editingId) {
        await api.updateSessionNote(editingId, payload);
      } else {
        await api.saveSessionNote(payload);
      }
      startNew();
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this session note? This cannot be undone.")) return;
    await api.deleteSessionNote(id);
    if (editingId === id) startNew();
    refresh();
  }

  const ownNotes = notes.filter((n) => n.userId === user?.id);

  return (
    <div className="page">
      <div className="tabs forge-mode-tabs">
        <button className={viewMode === "list" ? "active" : ""} aria-current={viewMode === "list" ? "true" : undefined} onClick={() => setViewMode("list")}>List</button>
        <button className={viewMode === "timeline" ? "active" : ""} aria-current={viewMode === "timeline" ? "true" : undefined} onClick={() => setViewMode("timeline")}>Timeline</button>
        <button className={viewMode === "prep" ? "active" : ""} aria-current={viewMode === "prep" ? "true" : undefined} onClick={() => setViewMode("prep")}>Prep</button>
      </div>

      {viewMode === "timeline" && (
        <SessionTimelineView
          entries={buildTimelineEntries(
            timelineWorldFilter ? notes.filter((n) => n.worldId === timelineWorldFilter) : notes,
            timelineQuests,
            timelineAdventures,
          )}
          worlds={worlds}
          worldFilter={timelineWorldFilter}
          onWorldFilterChange={setTimelineWorldFilter}
          onSelectEntry={(entry) => {
            const note = notes.find((n) => n.id === entry.entityId);
            if (note) openInEditor(note);
          }}
          onOpenInRoster={onOpenInRoster}
        />
      )}

      {viewMode === "prep" && (
        <SessionPrepView worldId={prepWorldId} setWorldId={setPrepWorldId} worlds={worlds} notes={notes} onSelectNote={openInEditor} />
      )}

      {viewMode === "list" && (
        <div className="generator-layout">
          <div className="panel">
            <div className="page-title">
              <NotesIcon className="page-title-icon" aria-hidden="true" />
              <h2>{editingId ? "Edit Session Note" : "New Session Note"}</h2>
            </div>
            <p className="hint">A quick recap so you never open a session unsure what happened last time.</p>

            <label className="field">
              <span>Title</span>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="The Fall of Blackwater Keep" />
            </label>
            <label className="field">
              <span>Session label (optional)</span>
              <input type="text" value={form.sessionLabel} onChange={(e) => setForm({ ...form, sessionLabel: e.target.value })} placeholder="Session 12, or a date" />
            </label>
            <label className="field">
              <span>Session date (optional)</span>
              <input type="date" value={form.sessionDate} onChange={(e) => setForm({ ...form, sessionDate: e.target.value })} />
            </label>
            <label className="field">
              <span>Summary</span>
              <textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={4} placeholder="What happened this session…" />
            </label>
            <label className="field">
              <span>Loose threads (optional)</span>
              <textarea value={form.looseThreads} onChange={(e) => setForm({ ...form, looseThreads: e.target.value })} rows={3} placeholder="Cliffhangers, unresolved questions…" />
            </label>
            <label className="field">
              <span>Next steps (optional)</span>
              <textarea value={form.nextSteps} onChange={(e) => setForm({ ...form, nextSteps: e.target.value })} rows={3} placeholder="What's planned for next time…" />
            </label>
            <label className="field">
              <span>World (optional)</span>
              <select value={form.worldId} onChange={(e) => setForm({ ...form, worldId: e.target.value })}>
                <option value="">Unassigned</option>
                {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Tags</span>
              <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="act-2, milestone" />
            </label>

            {error && <p className="error">{error}</p>}
            <div className="button-row">
              <button className="btn-primary" onClick={handleSave} disabled={status === "saving"}>
                {status === "saving" ? "Saving…" : editingId ? "Update Note" : "Save Note"}
              </button>
              {editingId && <button className="btn-secondary" onClick={startNew}>New Note</button>}
            </div>
          </div>

          <div className="panel result-panel">
            <h3 className="section-heading">Recent Session Notes</h3>
            {loading && <p className="hint">Loading…</p>}
            {!loading && ownNotes.length === 0 && (
              <EmptyState icon={<NotesIcon />} heading="No session notes yet" hint="Save your first recap above so you never open a session unsure what happened last time." />
            )}
            <ul className="entity-list">
              {ownNotes.map((n) => (
                <li key={n.id} className="world-row">
                  <button className="entity-item" style={{ border: "none", flex: 1 }} onClick={() => startEdit(n)}>
                    <span className="entity-name">{n.title}</span>
                    <span className="entity-meta">{n.sessionLabel || new Date(n.createdAt).toLocaleDateString()}</span>
                  </button>
                  <button className="btn-danger" onClick={() => handleDelete(n.id)} aria-label={`Delete ${n.title}`}>Delete</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
