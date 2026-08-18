import { useEffect, useState } from "react";
import { FREE_TIER_WORLD_LIMIT, FREE_TIER_GENERATE_LIMIT, PAID_TIER_GENERATE_LIMIT } from "@spark/shared";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export function BillingPage() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Coming back from a Stripe Checkout/Portal redirect — the tier flip
  // lands via webhook and may not have landed yet, so re-fetch once and
  // clear the query param so a manual refresh doesn't repeat it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("billing")) {
      refreshUser();
      params.delete("billing");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState(null, "", next);
    }
  }, [refreshUser]);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const { url } = await api.createCheckoutSession();
      if (url) window.location.href = url;
      else setError("Couldn't start checkout — please try again.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleManage() {
    setLoading(true);
    setError(null);
    try {
      const { url } = await api.createPortalSession();
      if (url) window.location.href = url;
      else setError("Couldn't open the billing portal — please try again.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const isPaid = user?.tier === "paid";

  return (
    <div className="page">
      <div className="panel">
        <h2>Billing</h2>
        <p className="hint">
          Every feature in Spark is free, forever — no exceptions. The paid plan only raises two usage caps: how
          many worlds you can have and how fast you can generate content.
        </p>

        <table className="plan-comparison">
          <thead>
            <tr>
              <th scope="col"></th>
              <th scope="col">Free</th>
              <th scope="col">Paid</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Worlds</th>
              <td>{FREE_TIER_WORLD_LIMIT}</td>
              <td>Unlimited</td>
            </tr>
            <tr>
              <th scope="row">Generations per minute</th>
              <td>{FREE_TIER_GENERATE_LIMIT}</td>
              <td>{PAID_TIER_GENERATE_LIMIT}</td>
            </tr>
          </tbody>
        </table>

        <div className="save-panel">
          <h3 className="section-heading">Current Plan</h3>
          <p className="entity-meta">{isPaid ? "Paid — higher limits" : "Free"}</p>
          {!isPaid && <p className="hint">You'll see the exact price and can review everything on the next screen before you pay anything.</p>}
          {error && <p className="error">{error}</p>}
          {isPaid ? (
            <button className="btn-secondary" onClick={handleManage} disabled={loading}>
              {loading ? "Opening…" : "Manage Subscription"}
            </button>
          ) : (
            <button className="btn-primary" onClick={handleUpgrade} disabled={loading}>
              {loading ? "Starting…" : "Upgrade"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
