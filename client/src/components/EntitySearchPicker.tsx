import { useEffect, useState } from "react";
import type { EntityType, SearchResult } from "@spark/shared";
import { api } from "../api";

export function EntitySearchPicker({
  type, onSelect, placeholder = "Start typing a name…",
}: {
  type: EntityType;
  onSelect: (result: SearchResult) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<SearchResult[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setCandidates([]);
      return;
    }
    const handle = setTimeout(() => {
      api.search(trimmed, type).then((res) => setCandidates(res.results)).catch(() => {});
    }, 250);
    return () => clearTimeout(handle);
  }, [query, type]);

  return (
    <div className="entity-search-picker">
      <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} />
      {candidates.length > 0 && (
        <ul className="entity-list">
          {candidates.map((c) => (
            <li key={c.id}>
              <button className="entity-item" onClick={() => onSelect(c)}>
                <span className="entity-name">{c.name}</span>
                <span className="entity-meta">{c.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && candidates.length === 0 && <p className="hint">No matches.</p>}
    </div>
  );
}
