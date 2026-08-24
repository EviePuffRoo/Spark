import { useState } from "react";
import type { AdminUserSummary } from "@spark/shared";
import { api } from "../api";

export function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resultLabel, setResultLabel] = useState<string | null>(null);
  const [resultValue, setResultValue] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { users } = await api.lookupUsers(query.trim());
      setUsers(users);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function selectUser(id: string) {
    setSelectedId(id);
    setNewPassword("");
    setResultLabel(null);
    setResultValue(null);
    setActionError(null);
  }

  const selected = users.find((u) => u.id === selectedId) ?? null;

  async function handleIssueRecoveryCode() {
    if (!selected) return;
    setActionError(null);
    setResultLabel(null);
    try {
      const { recoveryCode } = await api.adminIssueRecoveryCode(selected.id);
      setResultLabel(`New recovery code for ${selected.username}. Give this to them once, it won't be shown again:`);
      setResultValue(recoveryCode);
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !newPassword) return;
    setActionError(null);
    setResultLabel(null);
    try {
      await api.adminSetPassword(selected.id, newPassword);
      setResultLabel(`Temporary password set for ${selected.username}. Give this to them once, it won't be shown again:`);
      setResultValue(newPassword);
      setNewPassword("");
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  return (
    <div className="page">
      <div className="generator-layout">
        <div className="panel">
          <h2>Account Recovery</h2>
          <p className="hint">
            For a user who's lost their password, their recovery code, or both, verify their identity out of band
            first, then use these tools to get them back in.
          </p>

          <form className="field" onSubmit={handleSearch}>
            <span>Search by username</span>
            <div className="button-row">
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="username" />
              <button className="btn-primary" type="submit" disabled={loading}>{loading ? "Searching…" : "Search"}</button>
            </div>
          </form>

          {error && <p className="error">{error}</p>}
          {!loading && users.length === 0 && query && <p className="hint">No matching users.</p>}
          {users.length > 0 && (
            <ul className="entity-list">
              {users.map((u) => (
                <li key={u.id}>
                  <button className={`entity-item ${u.id === selectedId ? "active" : ""}`} onClick={() => selectUser(u.id)}>
                    <span className="entity-name">{u.username}</span>
                    <span className="entity-meta">
                      {u.role}{u.role === "admin" ? "" : ` · ${u.tier}`}{!u.canPublish ? " · publishing suspended" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel result-panel">
          {!selected && <p className="hint">Search for a user to manage their account recovery.</p>}
          {selected && (
            <>
              <p className="entity-meta">
                {selected.username}: {selected.role}, {selected.tier} tier, joined {new Date(selected.createdAt).toLocaleDateString()}
              </p>

              <h3 className="section-heading">Lost recovery code</h3>
              <div className="save-panel">
                <p className="hint">Issues a fresh recovery code without touching their password.</p>
                <button className="btn-secondary" onClick={handleIssueRecoveryCode}>Issue Recovery Code</button>
              </div>

              <h3 className="section-heading">Locked out entirely</h3>
              <div className="save-panel">
                <p className="hint">Sets a temporary password so they can log in and manage their own recovery from Profile.</p>
                <form onSubmit={handleSetPassword}>
                  <label className="field">
                    <span>Temporary password</span>
                    <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
                  </label>
                  <button className="btn-secondary" type="submit">Set Temporary Password</button>
                </form>
              </div>

              {actionError && <p className="error">{actionError}</p>}
            </>
          )}
          {resultLabel && resultValue && (
            <div className="save-panel">
              <p className="success">{resultLabel}</p>
              <p className="recovery-code">{resultValue}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
