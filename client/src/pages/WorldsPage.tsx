import { useEffect, useRef, useState } from "react";
import { api, type WorldSummary } from "../api";

function summarizeCounts(w: WorldSummary): string {
  const parts: [number, string][] = [
    [w.characterCount, "character"],
    [w.itemCount, "item"],
    [w.locationCount, "location"],
    [w.questCount, "quest"],
    [w.factionCount, "faction"],
    [w.encounterTableCount, "encounter table"],
    [w.sessionNoteCount, "session note"],
  ];
  const nonEmpty = parts.filter(([count]) => count > 0);
  if (nonEmpty.length === 0) return "Empty so far";
  return nonEmpty.map(([count, label]) => `${count} ${label}${count === 1 ? "" : "s"}`).join(" · ");
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "world";
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function WorldsPage({ onViewRoster }: { onViewRoster: (worldId: string) => void }) {
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    api.listWorlds().then(setWorlds).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function handleCreate() {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      await api.createWorld(name.trim(), description.trim() || undefined);
      setName("");
      setDescription("");
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this world? Its characters will become unassigned, not deleted.")) return;
    await api.deleteWorld(id);
    refresh();
  }

  async function handleExportWorld(w: WorldSummary) {
    try {
      const bundle = await api.exportWorld(w.id);
      downloadJson(`spark-${slugify(w.name)}-${new Date().toISOString().slice(0, 10)}.json`, bundle);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleExportAll() {
    try {
      const bundle = await api.exportAll();
      downloadJson(`spark-backup-${new Date().toISOString().slice(0, 10)}.json`, bundle);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleImportFile(file: File) {
    setError(null);
    setImportStatus(null);
    try {
      const text = await file.text();
      const bundle = JSON.parse(text);
      const result = await api.importBackup(bundle);
      setImportStatus(
        `Imported ${result.worldsImported} world${result.worldsImported === 1 ? "" : "s"}, ` +
        `${result.entitiesImported} entr${result.entitiesImported === 1 ? "y" : "ies"}, ` +
        `${result.linksImported} link${result.linksImported === 1 ? "" : "s"}.`
      );
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <h2>Worlds &amp; Campaigns</h2>
        <p className="hint">Group everything you create into worlds or campaigns as you build them out.</p>

        <div className="save-panel">
          <label className="field">
            <span>New world name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="The Sunken Coast" />
          </label>
          <label className="field">
            <span>Description (optional)</span>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <button className="btn-primary" onClick={handleCreate} disabled={creating}>{creating ? "Creating…" : "Create World"}</button>
        </div>

        <div className="button-row backup-row">
          <button className="btn-secondary" onClick={handleExportAll}>Export Everything</button>
          <button className="btn-secondary" onClick={() => importInputRef.current?.click()}>Import Backup</button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = "";
            }}
          />
        </div>
        {importStatus && <p className="success">{importStatus}</p>}
        {error && <p className="error">{error}</p>}

        <ul className="entity-list world-list">
          {worlds.map((w) => (
            <li key={w.id} className="world-row">
              <div>
                <div className="entity-name">{w.name}</div>
                {w.description && <div className="entity-meta">{w.description}</div>}
                <div className="entity-meta">{summarizeCounts(w)}</div>
              </div>
              <div className="button-row">
                <button className="btn-secondary" onClick={() => onViewRoster(w.id)}>View Roster</button>
                <button className="btn-secondary" onClick={() => handleExportWorld(w)}>Export</button>
                <button className="btn-danger" onClick={() => handleDelete(w.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
        {loading && <p className="hint">Loading…</p>}
        {!loading && worlds.length === 0 && <p className="hint">No worlds yet — create one above.</p>}
      </div>
    </div>
  );
}
