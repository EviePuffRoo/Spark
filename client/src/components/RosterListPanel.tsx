import type { QuestStatus } from "@spark/shared";
import { QUEST_STATUSES, QUEST_STATUS_LABELS } from "@spark/shared";
import type { WorldSummary } from "../api";
import { GroupedTabs } from "./GroupedTabs";

interface RosterListEntry {
  id: string;
  name: string;
  meta: string;
  hidden: boolean;
}

// The left-hand list panel — mode tabs, filters, and the entity list —
// with zero state of its own: every value and every change is owned by
// RosterPage, which recomputes activeList/availableTags on every render.
// Grouping data for GroupedTabs is passed through rather than imported
// from RosterPage.tsx, to keep this a leaf component with no import back
// up to its own parent.
export function RosterListPanel<M extends string, G extends string>({
  mode, onSwitchMode, onShowFactionWeb,
  groups, groupLabels, itemLabels, groupOf,
  searchFilter, onSearchFilterChange,
  worldFilter, onWorldFilterChange, worlds,
  availableTags, tagFilter, onTagFilterChange,
  statusFilter, onStatusFilterChange,
  loading, activeList, unfiltered,
  selectedId, onSelectId,
}: {
  mode: M;
  onSwitchMode: (m: M) => void;
  onShowFactionWeb: () => void;
  groups: Record<G, M[]>;
  groupLabels: Record<G, string>;
  itemLabels: Record<M, string>;
  groupOf: (item: M) => G;
  searchFilter: string;
  onSearchFilterChange: (v: string) => void;
  worldFilter: string;
  onWorldFilterChange: (v: string) => void;
  worlds: WorldSummary[];
  availableTags: string[];
  tagFilter: string;
  onTagFilterChange: (v: string) => void;
  statusFilter: QuestStatus | "";
  onStatusFilterChange: (v: QuestStatus | "") => void;
  loading: boolean;
  activeList: RosterListEntry[];
  unfiltered: boolean;
  selectedId: string | null;
  onSelectId: (id: string) => void;
}) {
  return (
    <div className="panel roster-list">
      <GroupedTabs
        className="roster-mode-tabs"
        groups={groups}
        groupLabels={groupLabels}
        itemLabels={itemLabels}
        groupOf={groupOf}
        active={mode}
        onSelect={onSwitchMode}
      />

      {mode === "factions" && (
        <button className="btn-secondary" onClick={onShowFactionWeb}>Relationship Web</button>
      )}

      <label className="field">
        <span>Search</span>
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => onSearchFilterChange(e.target.value)}
          placeholder={`Search ${itemLabels[mode].toLowerCase()}…`}
        />
      </label>

      <label className="field">
        <span>Filter by world</span>
        <select value={worldFilter} onChange={(e) => onWorldFilterChange(e.target.value)}>
          <option value="">All</option>
          <option value="unassigned">Unassigned</option>
          {worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </label>

      {availableTags.length > 0 && (
        <label className="field">
          <span>Filter by tag</span>
          <select value={tagFilter} onChange={(e) => onTagFilterChange(e.target.value)}>
            <option value="">All tags</option>
            {availableTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      )}

      {mode === "quests" && (
        <label className="field">
          <span>Filter by status</span>
          <select value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value as QuestStatus | "")}>
            <option value="">All statuses</option>
            {QUEST_STATUSES.map((s) => <option key={s} value={s}>{QUEST_STATUS_LABELS[s]}</option>)}
          </select>
        </label>
      )}

      {loading && <p className="hint">Loading…</p>}
      {!loading && activeList.length === 0 && (
        <p className="hint">
          {unfiltered ? "No matches for your filters." : `No saved ${itemLabels[mode].toLowerCase()} yet.`}
        </p>
      )}
      <ul className="entity-list">
        {activeList.map((entry) => (
          <li key={entry.id}>
            <button
              className={`entity-item ${entry.id === selectedId ? "active" : ""}`}
              aria-current={entry.id === selectedId ? "true" : undefined}
              onClick={() => onSelectId(entry.id)}
            >
              <span className="entity-name">
                {entry.name}
                {entry.hidden && <span className="hidden-badge" title="Hidden from party">🔒</span>}
              </span>
              <span className="entity-meta">{entry.meta}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
