import type { ReactNode } from "react";
import { useEffect, useState } from "react";

// A two-level tab selector: a short row of category groups, and beneath it
// the (few) items within whichever group is active. Used where a flat tab
// row would have too many items to fit on one line (Create/Roster's dozen-
// plus entity types) — grouping keeps every row to a handful of items so
// none of them ever wrap, regardless of window width.
export function GroupedTabs<T extends string, G extends string>({
  groups, groupLabels, itemLabels, groupOf, active, onSelect, className, itemBadge,
}: {
  groups: Record<G, T[]>;
  groupLabels: Record<G, string>;
  itemLabels: Record<T, string>;
  groupOf: (item: T) => G;
  active: T;
  onSelect: (item: T) => void;
  className?: string;
  // Optional per-item indicator (e.g. an unseen-activity dot) rendered
  // after the item's label. Additive/optional so existing callers that
  // only pass plain string labels are unaffected.
  itemBadge?: (item: T) => ReactNode;
}) {
  const [activeGroup, setActiveGroup] = useState<G>(() => groupOf(active));

  // Keep the visible group in sync when `active` changes from outside this
  // component (e.g. another page navigates straight to a specific item).
  useEffect(() => {
    setActiveGroup(groupOf(active));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const groupKeys = Object.keys(groups) as G[];

  return (
    <div className={`grouped-tabs ${className ?? ""}`}>
      <div className="tabs grouped-tabs-groups" role="tablist">
        {groupKeys.map((g) => (
          <button
            key={g}
            role="tab"
            className={activeGroup === g ? "active" : ""}
            aria-selected={activeGroup === g}
            onClick={() => { setActiveGroup(g); onSelect(groups[g][0]); }}
          >
            {groupLabels[g]}
          </button>
        ))}
      </div>
      <div className="tabs grouped-tabs-items" role="tablist">
        {groups[activeGroup].map((item) => (
          <button
            key={item}
            role="tab"
            className={active === item ? "active" : ""}
            aria-selected={active === item}
            onClick={() => onSelect(item)}
          >
            {itemLabels[item]}
            {itemBadge?.(item)}
          </button>
        ))}
      </div>
    </div>
  );
}
