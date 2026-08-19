import { useEffect, useState } from "react";
import type { AdminStats } from "@spark/shared";
import { api } from "../api";

export function AdminStatsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.adminStats().then(setStats).catch((e) => setError((e as Error).message));
  }, []);

  const paidPct = stats && stats.totalUsers > 0 ? Math.round((stats.paidUsers / stats.totalUsers) * 100) : 0;

  return (
    <div className="page">
      <div className="panel">
        <h2>Stats</h2>
        <p className="hint">Read-only aggregate counts — no per-user activity tracking, just totals already in the database.</p>

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
            "Sample worlds loaded" is an estimate — it counts worlds still named "The Salt Coast", not a tracked event.
          </p>
        )}
      </div>
    </div>
  );
}
