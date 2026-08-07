import { useEffect, useState } from "react";
import type { EntityType, EntityLink, SearchResult } from "@spark/shared";
import { api } from "../api";

const TYPE_LABELS: Record<EntityType, string> = {
  character: "Character",
  item: "Item",
  location: "Location",
  quest: "Quest Hook",
  faction: "Faction",
  encounterTable: "Encounter Table",
  sessionNote: "Session Note",
  adventure: "Adventure",
  playerCharacter: "Player Character",
  zoneMapTemplate: "Zone Map Template",
  dungeon: "Dungeon",
};

const ALL_TYPES = Object.keys(TYPE_LABELS) as EntityType[];

export function LinkedEntities({ type, id }: { type: EntityType; id: string }) {
  const [links, setLinks] = useState<EntityLink[]>([]);
  const [adding, setAdding] = useState(false);
  const [targetType, setTargetType] = useState<EntityType>(ALL_TYPES.find((t) => t !== type) ?? "character");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<SearchResult[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<SearchResult | null>(null);
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.getLinks(type, id).then(setLinks).catch(() => {});
  }

  useEffect(refresh, [type, id]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setCandidates([]);
      return;
    }
    const handle = setTimeout(() => {
      api.search(trimmed, targetType).then((res) => setCandidates(res.results)).catch(() => {});
    }, 250);
    return () => clearTimeout(handle);
  }, [query, targetType]);

  function resetAddForm() {
    setAdding(false);
    setQuery("");
    setCandidates([]);
    setSelectedTarget(null);
    setLabel("");
    setError(null);
  }

  async function handleAdd() {
    if (!selectedTarget) return;
    setStatus("saving");
    setError(null);
    try {
      await api.createLink(type, id, selectedTarget.type, selectedTarget.id, label.trim() || undefined);
      resetAddForm();
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  async function handleRemove(linkId: string) {
    await api.deleteLink(linkId);
    refresh();
  }

  return (
    <div className="linked-entities">
      <h3 className="section-heading">Linked Entries</h3>
      {links.length === 0 && !adding && <p className="hint">Nothing linked yet.</p>}
      {links.length > 0 && (
        <ul className="entity-list">
          {links.map((link) => (
            <li key={link.id} className="world-row">
              <div>
                <div className="entity-name">{link.other.name}</div>
                <div className="entity-meta">{TYPE_LABELS[link.other.type]}{link.label ? ` · ${link.label}` : ""}</div>
              </div>
              <button className="btn-danger" onClick={() => handleRemove(link.id)} aria-label={`Remove link to ${link.other.name}`}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      {!adding && <button className="btn-secondary" onClick={() => setAdding(true)}>+ Add Link</button>}

      {adding && (
        <div className="save-panel">
          <label className="field">
            <span>Link to</span>
            <select value={targetType} onChange={(e) => { setTargetType(e.target.value as EntityType); setSelectedTarget(null); setQuery(""); }}>
              {ALL_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </label>

          {!selectedTarget && (
            <label className="field">
              <span>Search</span>
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Start typing a name…" />
            </label>
          )}
          {!selectedTarget && candidates.length > 0 && (
            <ul className="entity-list">
              {candidates.map((c) => (
                <li key={c.id}>
                  <button className="entity-item" onClick={() => setSelectedTarget(c)}>
                    <span className="entity-name">{c.name}</span>
                    <span className="entity-meta">{c.meta}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selectedTarget && (
            <p className="hint">
              Linking to <strong>{selectedTarget.name}</strong>{" "}
              <button className="btn-secondary" onClick={() => setSelectedTarget(null)}>Change</button>
            </p>
          )}

          <label className="field">
            <span>Relationship (optional)</span>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="works for, located at, ally of…" />
          </label>

          {error && <p className="error">{error}</p>}
          <div className="button-row">
            <button className="btn-primary" onClick={handleAdd} disabled={!selectedTarget || status === "saving"}>
              {status === "saving" ? "Linking…" : "Add Link"}
            </button>
            <button className="btn-secondary" onClick={resetAddForm}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
