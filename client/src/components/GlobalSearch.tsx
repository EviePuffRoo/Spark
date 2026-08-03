import { useEffect, useRef, useState } from "react";
import type { EntityType, SearchResult } from "@spark/shared";
import { api } from "../api";

const TYPE_LABELS: Record<EntityType, string> = {
  character: "Character",
  item: "Item",
  location: "Location",
  quest: "Quest Hook",
  faction: "Faction",
  encounterTable: "Encounter Table",
  sessionNote: "Session Note",
};

export function GlobalSearch({ onSelect }: { onSelect: (type: EntityType, id: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      api.search(trimmed).then((res) => {
        setResults(res.results);
        setOpen(true);
      }).catch(() => {});
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(result: SearchResult) {
    onSelect(result.type, result.id);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="global-search" ref={containerRef}>
      <input
        type="text"
        placeholder="Search everything…"
        aria-label="Search everything"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />
      <span className="sr-only" role="status">
        {open && (results.length > 0 ? `${results.length} result${results.length === 1 ? "" : "s"} found.` : "No matches found.")}
      </span>
      {open && (
        <div className="global-search-results">
          {results.length === 0 && <div className="global-search-empty">No matches.</div>}
          {results.map((r) => (
            <button key={`${r.type}-${r.id}`} className="global-search-result" onClick={() => handleSelect(r)}>
              <span className="global-search-name">{r.name}</span>
              <span className="global-search-type">{TYPE_LABELS[r.type]}{r.meta ? ` · ${r.meta}` : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
