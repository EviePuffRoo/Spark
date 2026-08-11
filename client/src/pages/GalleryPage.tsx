import { useEffect, useState } from "react";
import type { EntityType, PublicGalleryEntry } from "@spark/shared";
import { ENTITY_TYPES } from "@spark/shared";
import { api } from "../api";
import { StatBlockView } from "../components/StatBlockView";
import { BackstoryView } from "../components/BackstoryView";
import { ItemCardView } from "../components/ItemCardView";
import { LocationCardView } from "../components/LocationCardView";
import { QuestHookCardView } from "../components/QuestHookCardView";
import { FactionCardView } from "../components/FactionCardView";
import { EncounterTableCardView } from "../components/EncounterTableCardView";
import { SessionNoteCardView } from "../components/SessionNoteCardView";
import { AdventureCardView } from "../components/AdventureCardView";
import { PlayerCharacterCardView } from "../components/PlayerCharacterCardView";
import { ZoneMapTemplateCardView } from "../components/ZoneMapTemplateCardView";
import { DungeonCardView } from "../components/DungeonCardView";
import { ShopCardView } from "../components/ShopCardView";
import { RegionCardView } from "../components/RegionCardView";
import { SettlementCardView } from "../components/SettlementCardView";

const ENTITY_TYPE_LABELS: Record<EntityType, string> = Object.fromEntries(
  ENTITY_TYPES.map((t) => [t.type, t.label])
) as Record<EntityType, string>;

function renderEntryDetail(entityType: EntityType, data: any) {
  switch (entityType) {
    case "character":
      return (
        <>
          <StatBlockView
            name={data.name}
            subtitle={`${data.statBlock.size} ${data.statBlock.creatureType}, ${data.statBlock.alignment}${data.race ? ` — ${data.race}` : ""}`}
            statBlock={data.statBlock}
          />
          <BackstoryView backstory={data.backstory} />
        </>
      );
    case "item": return <ItemCardView item={data} />;
    case "location": return <LocationCardView location={data} />;
    case "quest": return <QuestHookCardView quest={data} />;
    case "faction": return <FactionCardView faction={data} />;
    case "encounterTable": return <EncounterTableCardView table={data} />;
    case "sessionNote": return <SessionNoteCardView note={data} />;
    case "adventure": return <AdventureCardView adventure={data} />;
    case "playerCharacter": return <PlayerCharacterCardView pc={data} />;
    case "zoneMapTemplate": return <ZoneMapTemplateCardView template={data} />;
    case "dungeon": return <DungeonCardView dungeon={data} />;
    case "shop": return <ShopCardView shop={data} />;
    case "region": return <RegionCardView region={data} />;
    case "settlement": return <SettlementCardView settlement={data} />;
    default: return null;
  }
}

interface DetailState {
  entry: PublicGalleryEntry;
  data: unknown;
}

export function GalleryPage() {
  const [typeFilter, setTypeFilter] = useState<EntityType | "">("");
  const [entries, setEntries] = useState<PublicGalleryEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cloneStatus, setCloneStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setSelectedId(null);
    setDetail(null);
    api.listPublicGallery({ entityType: typeFilter || undefined })
      .then((r) => { setEntries(r.entries); setNextCursor(r.nextCursor); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [typeFilter]);

  async function loadMore() {
    if (!nextCursor) return;
    try {
      const r = await api.listPublicGallery({ entityType: typeFilter || undefined, cursor: nextCursor });
      setEntries((prev) => [...prev, ...r.entries]);
      setNextCursor(r.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function selectEntry(id: string) {
    setSelectedId(id);
    setDetail(null);
    setCloneStatus(null);
    setDetailLoading(true);
    try {
      const full = await api.getPublicGalleryEntry(id);
      setDetail({
        entry: {
          id: full.id, entityType: full.entityType, entityId: full.entityId, title: full.title,
          description: full.description, name: "", meta: "", publisherUsername: full.publisherUsername, publishedAt: full.publishedAt,
        },
        data: full.data,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleClone() {
    if (!selectedId) return;
    setCloneStatus(null);
    try {
      await api.cloneFromGallery(selectedId);
      setCloneStatus("Cloned to your Roster.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const filtered = entries.filter((e) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return e.name.toLowerCase().includes(q) || e.title.toLowerCase().includes(q);
  });

  return (
    <div className="page">
      <div className="generator-layout">
        <div className="panel">
          <h2>Homebrew Gallery</h2>
          <p className="hint">Browse and clone content other Spark users have published.</p>

          <label className="field">
            <span>Type</span>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as EntityType | "")}>
              <option value="">All types</option>
              {ENTITY_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Search</span>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this page…" />
          </label>

          {error && <p className="error">{error}</p>}
          {loading ? (
            <p className="hint">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="hint">Nothing published yet.</p>
          ) : (
            <ul className="entity-list">
              {filtered.map((e) => (
                <li key={e.id}>
                  <button className={`entity-item ${e.id === selectedId ? "active" : ""}`} onClick={() => selectEntry(e.id)}>
                    <span className="entity-name">{e.name || e.title}</span>
                    <span className="entity-meta">{e.meta}{e.meta ? " · " : ""}{ENTITY_TYPE_LABELS[e.entityType]} · by {e.publisherUsername}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!loading && nextCursor && (
            <button className="btn-secondary" onClick={loadMore}>Load More</button>
          )}
        </div>

        <div className="panel result-panel">
          {!selectedId && <p className="hint">Select an entry to view it.</p>}
          {detailLoading && <p className="hint">Loading…</p>}
          {detail && !detailLoading && (
            <>
              <p className="entity-meta">
                "{detail.entry.title}" — published by {detail.entry.publisherUsername} on {new Date(detail.entry.publishedAt).toLocaleDateString()}
              </p>
              {detail.entry.description && <p>{detail.entry.description}</p>}
              {renderEntryDetail(detail.entry.entityType, detail.data)}
              <div className="button-row">
                <button className="btn-primary" onClick={handleClone}>Clone to my Roster</button>
              </div>
              {cloneStatus && <p className="success">{cloneStatus}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
