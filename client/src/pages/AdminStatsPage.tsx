import { useEffect, useState } from "react";
import type { AdminStats } from "@spark/shared";
import { api } from "../api";

export function AdminStatsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<"idle" | "running">("idle");
  const [backupResult, setBackupResult] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  useEffect(() => {
    api.adminStats().then(setStats).catch((e) => setError((e as Error).message));
  }, []);

  async function runBackup() {
    setBackupStatus("running");
    setBackupResult(null);
    setBackupError(null);
    try {
      const { key, pruned } = await api.runDatabaseBackup();
      setBackupResult(`Uploaded ${key}${pruned > 0 ? `, pruned ${pruned} old backup${pruned === 1 ? "" : "s"}` : ""}`);
    } catch (e) {
      setBackupError((e as Error).message);
    } finally {
      setBackupStatus("idle");
    }
  }

  const paidPct = stats && stats.totalUsers > 0 ? Math.round((stats.paidUsers / stats.totalUsers) * 100) : 0;

  return (
    <div className="page">
      <div className="panel">
        <h2>Stats</h2>
        <p className="hint">Read-only aggregate counts. No per-user activity tracking, just totals already in the database.</p>

        {error && <p className="error">{error}</p>}
        {!stats && !error && <p className="hint">Loading…</p>}

        {stats && (
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-value">{stats.totalUsers}</span>
              <span className="stat-label">Total users</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.paidUsers}</span>
              <span className="stat-label">Paid ({paidPct}%)</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.freeUsers}</span>
              <span className="stat-label">Free</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.signupsLast7Days}</span>
              <span className="stat-label">Signups, last 7 days</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.signupsLast30Days}</span>
              <span className="stat-label">Signups, last 30 days</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.totalWorlds}</span>
              <span className="stat-label">Total worlds</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.starterWorldsCreated}</span>
              <span className="stat-label">Sample worlds loaded (est.)</span>
            </div>
          </div>
        )}
        {stats && (
          <p className="hint">
            "Sample worlds loaded" is an estimate. It counts worlds still named "The Salt Coast", not a tracked event.
          </p>
        )}
      </div>

      <div className="panel">
        <h2>Database Backups</h2>
        <p className="hint">
          Triggers the same backup the scheduled daily job runs, useful right before a risky
          deploy or migration, without waiting for the next scheduled window.
        </p>
        <button className="btn-secondary" onClick={runBackup} disabled={backupStatus === "running"}>
          {backupStatus === "running" ? "Backing up…" : "Run Backup Now"}
        </button>
        {backupResult && <p className="hint">{backupResult}</p>}
        {backupError && <p className="error">{backupError}</p>}
      </div>
    </div>
  );
}
