import { useState } from "react";
import type { WorldTickProposal, WorldTickProposalItem } from "@spark/shared";
import { api, type WorldSummary } from "../api";

const KIND_LABELS: Record<WorldTickProposalItem["kind"], string> = {
  factionReputation: "Faction Reputation",
  characterDisposition: "NPC Disposition",
  shopStock: "Shop Prices",
  campaignEvent: "Campaign Events",
};

export function WorldTickPanel({ world, onUpdated }: { world: WorldSummary; onUpdated: () => void }) {
  const [proposal, setProposal] = useState<WorldTickProposal | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  if (!world.isOwner) return null;

  async function simulate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const p = await api.getWorldTickProposal(world.id);
      setProposal(p);
      setChecked(Object.fromEntries(p.items.map((i) => [i.id, true])));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function discard() {
    setProposal(null);
    setChecked({});
    setError(null);
  }

  async function apply() {
    if (!proposal) return;
    const items = proposal.items.filter((i) => checked[i.id]);
    if (items.length === 0) {
      discard();
      return;
    }
    setApplying(true);
    setError(null);
    try {
      await api.applyWorldTick(world.id, { worldId: world.id, fromDay: proposal.fromDay, toDay: proposal.toDay, items });
      setResult(`Applied ${items.length} change${items.length === 1 ? "" : "s"} for days ${proposal.fromDay}–${proposal.toDay}.`);
      setProposal(null);
      setChecked({});
      onUpdated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  }

  const grouped = proposal
    ? proposal.items.reduce<Record<string, WorldTickProposalItem[]>>((acc, item) => {
        (acc[item.kind] ??= []).push(item);
        return acc;
      }, {})
    : null;
  const checkedCount = proposal ? proposal.items.filter((i) => checked[i.id]).length : 0;

  return (
    <div className="world-tick-panel">
      <div className="button-row">
        <button className="btn-secondary" onClick={simulate} disabled={loading}>
          {loading ? "Simulating…" : "Simulate World"}
        </button>
        {proposal && (
          <>
            <button className="btn-primary" onClick={apply} disabled={applying || checkedCount === 0}>
              {applying ? "Applying…" : `Apply ${checkedCount} Change${checkedCount === 1 ? "" : "s"}`}
            </button>
            <button className="link-button" onClick={discard} disabled={applying}>Discard</button>
          </>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {result && <p className="success">{result}</p>}
      {proposal && proposal.items.length === 0 && (
        <p className="hint">No changes proposed — nothing has happened since day {proposal.fromDay}.</p>
      )}
      {proposal && grouped && proposal.items.length > 0 && (
        <div className="world-tick-review">
          <p className="hint">Simulating days {proposal.fromDay}–{proposal.toDay}. Review and uncheck anything you don't want applied.</p>
          {Object.entries(grouped).map(([kind, items]) => (
            <div key={kind} className="world-tick-group">
              <h4 className="world-tick-group-heading">{KIND_LABELS[kind as WorldTickProposalItem["kind"]]}</h4>
              <ul className="world-tick-item-list">
                {items.map((item) => (
                  <li key={item.id} className="world-tick-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={!!checked[item.id]}
                        onChange={(e) => setChecked((c) => ({ ...c, [item.id]: e.target.checked }))}
                      />
                      <span>{item.summary}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
