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
  adventure: "Adventure",
  playerCharacter: "Player Character",
  zoneMapTemplate: "Zone Map Template",
  dungeon: "Dungeon",
  shop: "Shop",
  region: "Region",
  settlement: "Settlement",
  battleMap: "Battle Map",
};

// A narrow subset of App.tsx's own Area/SubTab string-literal unions —
// kept local rather than imported, matching the existing convention where
// a leaf component (see WorldOverviewPage.tsx's OverviewNavTarget) defines
// its own nav-target type and the parent's callback accepts it, not the
// reverse. Admin-only screens (moderation/users/stats) are deliberately
// left out of quick-nav.
type NavArea = "prep" | "world" | "play" | "account";
type NavSubTab =
  | "create" | "compendium" | "overview" | "worlds" | "roster" | "codex" | "notes"
  | "downtime" | "tavern" | "combat" | "mapBuilder" | "shop" | "inventory"
  | "gallery" | "profile" | "myCharacter" | "billing";

const NAV_DESTINATIONS: { label: string; area: NavArea; subTab: NavSubTab }[] = [
  { label: "Combat", area: "play", subTab: "combat" },
  { label: "Map Builder", area: "play", subTab: "mapBuilder" },
  { label: "Shop", area: "play", subTab: "shop" },
  { label: "Inventory", area: "play", subTab: "inventory" },
  { label: "World Overview", area: "world", subTab: "overview" },
  { label: "Doom Clock", area: "world", subTab: "overview" },
  { label: "Trigger Rules", area: "world", subTab: "overview" },
  { label: "Roster", area: "world", subTab: "roster" },
  { label: "Codex", area: "world", subTab: "codex" },
  { label: "Session Notes", area: "world", subTab: "notes" },
  { label: "Downtime", area: "world", subTab: "downtime" },
  { label: "Tavern", area: "world", subTab: "tavern" },
  { label: "Worlds", area: "world", subTab: "worlds" },
  { label: "Create", area: "prep", subTab: "create" },
  { label: "Compendium", area: "prep", subTab: "compendium" },
  { label: "Profile", area: "account", subTab: "profile" },
  { label: "My Character", area: "account", subTab: "myCharacter" },
  { label: "Billing", area: "account", subTab: "billing" },
  { label: "Gallery", area: "account", subTab: "gallery" },
];

export function GlobalSearch({
  onSelect, onNavigate,
}: {
  onSelect: (type: EntityType, id: string) => void;
  onNavigate: (area: NavArea, subTab: NavSubTab) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmedQuery = query.trim().toLowerCase();
  const navMatches = trimmedQuery
    ? NAV_DESTINATIONS.filter((d) => d.label.toLowerCase().includes(trimmedQuery))
    : [];

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

  // Nav-destination matches are computed synchronously from the query (no
  // debounce needed, it's a small in-memory list), but still need to open
  // the results panel the moment a match appears rather than waiting on
  // the entity-search effect above.
  useEffect(() => {
    if (navMatches.length > 0) setOpen(true);
  }, [navMatches.length]);

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

  function handleNavigate(dest: (typeof NAV_DESTINATIONS)[number]) {
    onNavigate(dest.area, dest.subTab);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  const hasAnyMatches = navMatches.length > 0 || results.length > 0;

  return (
    <div className="global-search" ref={containerRef}>
      <input
        type="text"
        placeholder="Search everything…"
        aria-label="Search everything"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => hasAnyMatches && setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />
      <span className="sr-only" role="status">
        {open && (hasAnyMatches ? `${navMatches.length + results.length} result${navMatches.length + results.length === 1 ? "" : "s"} found.` : "No matches found.")}
      </span>
      {open && (
        <div className="global-search-results">
          {!hasAnyMatches && <div className="global-search-empty">No matches.</div>}
          {navMatches.map((d) => (
            <button key={`nav-${d.area}-${d.subTab}-${d.label}`} className="global-search-result global-search-nav-result" onClick={() => handleNavigate(d)}>
              <span className="global-search-name">{d.label}</span>
              <span className="global-search-type">Go to</span>
            </button>
          ))}
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
