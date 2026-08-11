import { useEffect, useRef, useState } from "react";
import { api, type WorldSummary, type WorldMemberInfo } from "../api";
import { useActiveWorld } from "../ActiveWorldContext";
import { downloadJson } from "../downloadJson";

function summarizeCounts(w: WorldSummary): string {
  const parts: [number, string][] = [
    [w.characterCount, "character"],
    [w.itemCount, "item"],
    [w.locationCount, "location"],
    [w.questCount, "quest"],
    [w.factionCount, "faction"],
    [w.encounterTableCount, "encounter table"],
    [w.sessionNoteCount, "session note"],
    [w.adventureCount, "adventure"],
    [w.playerCharacterCount, "player character"],
  ];
  const nonEmpty = parts.filter(([count]) => count > 0);
  if (nonEmpty.length === 0) return "Empty so far";
  return nonEmpty.map(([count, label]) => `${count} ${label}${count === 1 ? "" : "s"}`).join(" · ");
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "world";
}

export function WorldsPage({ onViewRoster }: { onViewRoster: (worldId: string) => void }) {
  const { refreshWorlds, setWorldId } = useActiveWorld();
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadingStarter, setLoadingStarter] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinStatus, setJoinStatus] = useState<string | null>(null);

  const [expandedWorldId, setExpandedWorldId] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [members, setMembers] = useState<WorldMemberInfo[]>([]);
  const [memberError, setMemberError] = useState<string | null>(null);

  function refresh() {
    api.listWorlds().then(setWorlds).catch((e) => setError(e.message)).finally(() => setLoading(false));
    refreshWorlds();
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

  async function handleLoadStarter() {
    if (loadingStarter) return;
    setLoadingStarter(true);
    setError(null);
    try {
      const { worldId } = await api.createStarterWorld();
      refresh();
      setWorldId(worldId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingStarter(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this world? Everything in it (characters, items, locations, quests, factions, encounter tables, player characters, and session notes) will become unassigned, not deleted. Anyone it was shared with will lose access.")) return;
    try {
      await api.deleteWorld(id);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
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

  async function toggleInvitePanel(worldId: string) {
    if (expandedWorldId === worldId) {
      setExpandedWorldId(null);
      return;
    }
    setExpandedWorldId(worldId);
    setGeneratedCode(null);
    setMemberError(null);
    try {
      setMembers(await api.getWorldMembers(worldId));
    } catch (e) {
      setMemberError((e as Error).message);
    }
  }

  async function handleGenerateCode(worldId: string) {
    try {
      const { code } = await api.generateWorldJoinCode(worldId);
      setGeneratedCode(code);
    } catch (e) {
      setMemberError((e as Error).message);
    }
  }

  async function handleRemoveMember(worldId: string, userId: string) {
    if (!confirm("Remove this member? They'll lose access to the world immediately.")) return;
    try {
      await api.removeWorldMember(worldId, userId);
      setMembers(await api.getWorldMembers(worldId));
      refresh();
    } catch (e) {
      setMemberError((e as Error).message);
    }
  }

  async function handleLeave(worldId: string, worldName: string) {
    if (!confirm(`Leave "${worldName}"? You'll lose access unless you're invited back.`)) return;
    try {
      await api.leaveWorld(worldId);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleJoin() {
    if (!joinCodeInput.trim() || joining) return;
    setJoining(true);
    setError(null);
    setJoinStatus(null);
    try {
      const result = await api.joinWorld(joinCodeInput.trim());
      setJoinStatus(`Joined "${result.worldName}".`);
      setJoinCodeInput("");
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJoining(false);
    }
  }

  const myWorlds = worlds.filter((w) => w.isOwner);
  const sharedWorlds = worlds.filter((w) => !w.isOwner);

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
          {worlds.length === 0 && !loading && (
            <button className="btn-secondary" onClick={handleLoadStarter} disabled={loadingStarter}>
              {loadingStarter ? "Loading…" : "Load a Sample World"}
            </button>
          )}
        </div>

        <div className="save-panel">
          <label className="field">
            <span>Join a world</span>
            <input type="text" value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" />
          </label>
          <button className="btn-secondary" onClick={handleJoin} disabled={joining}>{joining ? "Joining…" : "Join World"}</button>
          {joinStatus && <p className="success">{joinStatus}</p>}
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

        <h3 className="section-heading">My Worlds</h3>
        <ul className="entity-list world-list">
          {myWorlds.map((w) => (
            <li key={w.id} className="world-row">
              <div>
                <div className="entity-name">{w.name}</div>
                {w.description && <div className="entity-meta">{w.description}</div>}
                <div className="entity-meta">{summarizeCounts(w)}</div>
              </div>
              <div className="button-row">
                <button className="btn-secondary" onClick={() => onViewRoster(w.id)} aria-label={`View roster for ${w.name}`}>View Roster</button>
                <button className="btn-secondary" onClick={() => toggleInvitePanel(w.id)} aria-label={`Manage sharing for ${w.name}`} aria-expanded={expandedWorldId === w.id}>
                  {expandedWorldId === w.id ? "Hide Sharing" : "Sharing"}
                </button>
                <button className="btn-secondary" onClick={() => handleExportWorld(w)} aria-label={`Export ${w.name}`}>Export</button>
                <button className="btn-danger" onClick={() => handleDelete(w.id)} aria-label={`Delete ${w.name}`}>Delete</button>
              </div>

              {expandedWorldId === w.id && (
                <div className="save-panel world-sharing-panel">
                  <h3 className="section-heading">Sharing</h3>
                  <button className="btn-secondary" onClick={() => handleGenerateCode(w.id)}>
                    {generatedCode ? "Regenerate Invite Code" : "Get Invite Code"}
                  </button>
                  {generatedCode && (
                    <p className="hint">
                      Share this code — it won't be shown again: <strong>{generatedCode}</strong>
                    </p>
                  )}
                  {memberError && <p className="error">{memberError}</p>}
                  {members.length === 0 && <p className="hint">Nobody has joined this world yet.</p>}
                  {members.length > 0 && (
                    <ul className="entity-list">
                      {members.map((m) => (
                        <li key={m.userId} className="world-row">
                          <span className="entity-name">{m.username}</span>
                          <button className="btn-danger" onClick={() => handleRemoveMember(w.id, m.userId)} aria-label={`Remove ${m.username}`}>Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        {loading && <p className="hint">Loading…</p>}
        {!loading && myWorlds.length === 0 && <p className="hint">No worlds yet — create one above.</p>}

        {sharedWorlds.length > 0 && (
          <>
            <h3 className="section-heading">Shared With Me</h3>
            <ul className="entity-list world-list">
              {sharedWorlds.map((w) => (
                <li key={w.id} className="world-row">
                  <div>
                    <div className="entity-name">{w.name}</div>
                    {w.ownerUsername && <div className="entity-meta">Shared by {w.ownerUsername}</div>}
                    <div className="entity-meta">{summarizeCounts(w)}</div>
                  </div>
                  <div className="button-row">
                    <button className="btn-secondary" onClick={() => onViewRoster(w.id)} aria-label={`View roster for ${w.name}`}>View Roster</button>
                    <button className="btn-secondary" onClick={() => handleExportWorld(w)} aria-label={`Export ${w.name}`}>Export</button>
                    <button className="btn-danger" onClick={() => handleLeave(w.id, w.name)} aria-label={`Leave ${w.name}`}>Leave</button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
