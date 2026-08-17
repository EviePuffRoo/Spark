import { useState } from "react";
import { api, type WorldSummary } from "../api";

function toLocalInputValue(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatSessionTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function NextSessionPanel({ world, onUpdated }: { world: WorldSummary; onUpdated: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => toLocalInputValue(world.nextSessionAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api.updateWorld(world.id, { nextSessionAt: value ? new Date(value).toISOString() : null });
      onUpdated();
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    setError(null);
    try {
      await api.updateWorld(world.id, { nextSessionAt: null });
      setValue("");
      onUpdated();
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!world.isOwner) {
    if (!world.nextSessionAt) return null;
    return <p className="next-session-line">Next session: <strong>{formatSessionTime(world.nextSessionAt)}</strong></p>;
  }

  if (!editing) {
    return (
      <p className="next-session-line">
        {world.nextSessionAt ? (
          <>Next session: <strong>{formatSessionTime(world.nextSessionAt)}</strong></>
        ) : (
          <span className="hint">No next session scheduled.</span>
        )}
        {" "}
        <button className="link-button" onClick={() => setEditing(true)}>
          {world.nextSessionAt ? "Change" : "Schedule one"}
        </button>
      </p>
    );
  }

  return (
    <div className="next-session-editor">
      <label className="field">
        <span>Next session</span>
        <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="button-row">
        <button className="btn-secondary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        {world.nextSessionAt && <button className="btn-secondary" onClick={handleClear} disabled={saving}>Clear</button>}
        <button className="btn-secondary" onClick={() => { setEditing(false); setValue(toLocalInputValue(world.nextSessionAt)); }} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}
