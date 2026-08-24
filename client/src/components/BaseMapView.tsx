import { useState } from "react";
import type { BaseState, BaseUpgradeCategory, BaseUpgradeDef } from "@spark/shared";
import { BASE_UPGRADES } from "@spark/shared";
import { describeEffect } from "../baseEffects";

const VIEWBOX = "0 0 800 560";
const WALL = { x: 100, y: 110, width: 600, height: 340 };
const SLOT_PADDING = 60;
const SLOT_SIZE = { width: 92, height: 66 };

const TOP_ROW_IDS = ["trade-post", "resident-blacksmith", "exotic-merchant", "herald-of-renown"];
const BOTTOM_ROW_IDS = ["common-room", "private-quarters", "library-archive", "training-yard"];

const CATEGORY_TINT: Record<BaseUpgradeCategory, string> = {
  trade: "var(--success)",
  influence: "var(--accent-2)",
  comfort: "var(--accent)",
  defenses: "var(--warning)",
};

function rowSlotCenters(count: number, y: number) {
  const usableWidth = WALL.width - SLOT_PADDING * 2;
  const spacing = usableWidth / count;
  return Array.from({ length: count }, (_, i) => ({
    x: WALL.x + SLOT_PADDING + spacing * i + spacing / 2,
    y,
  }));
}

function upgradeById(id: string): BaseUpgradeDef | undefined {
  return BASE_UPGRADES.find((u) => u.id === id);
}

// The strongest defensive upgrade the party has actually built determines
// how the wall renders — Stone Walls and Living Hedge Maze are mutually
// exclusive, so at most one of them is ever true alongside Palisade Fence.
function wallStyle(acquired: Set<string>): { stroke: string; width: number; dash?: string; rx: number } {
  if (acquired.has("stone-walls")) return { stroke: "var(--text)", width: 10, rx: 6 };
  if (acquired.has("living-hedge-maze")) return { stroke: "var(--success)", width: 10, dash: "2 10", rx: 26 };
  if (acquired.has("palisade-fence")) return { stroke: "var(--warning)", width: 5, rx: 8 };
  return { stroke: "var(--border)", width: 1.5, dash: "6 6", rx: 10 };
}

export function BaseMapView({ base }: { base: BaseState }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const acquired = new Set(base.acquiredUpgradeIds);

  const topSlots = TOP_ROW_IDS.map((id, i) => ({ id, ...rowSlotCenters(TOP_ROW_IDS.length, WALL.y + 90)[i] }));
  const bottomSlots = BOTTOM_ROW_IDS.map((id, i) => ({ id, ...rowSlotCenters(BOTTOM_ROW_IDS.length, WALL.y + WALL.height - 90)[i] }));
  const allianceOwnedId = ["thieves-guild-pact", "city-watch-charter"].find((id) => acquired.has(id));
  const allianceSlot = { id: allianceOwnedId ?? "thieves-guild-pact", x: WALL.x + WALL.width / 2, y: WALL.y + WALL.height - 20, isAllianceSlot: true };

  const wall = wallStyle(acquired);
  const hasWatchtower = acquired.has("watchtower");
  const selectedDef = selectedId ? upgradeById(selectedId) : null;
  const selectedOwned = selectedId ? acquired.has(selectedId) : false;
  const selectedUnlockedShop = selectedId ? base.unlockedShops.find((s) => s.upgradeId === selectedId) : undefined;

  function renderSlot(slot: { id: string; x: number; y: number; isAllianceSlot?: boolean }) {
    const def = upgradeById(slot.id);
    if (!def) return null;
    const owned = slot.isAllianceSlot ? !!allianceOwnedId : acquired.has(slot.id);
    const tint = CATEGORY_TINT[def.category];
    const label = slot.isAllianceSlot && !allianceOwnedId ? "Alliance" : def.name;

    return (
      <g
        key={slot.id}
        className="base-map-slot"
        transform={`translate(${slot.x - SLOT_SIZE.width / 2} ${slot.y - SLOT_SIZE.height / 2})`}
        onClick={() => setSelectedId(slot.id)}
      >
        <rect
          width={SLOT_SIZE.width}
          height={SLOT_SIZE.height}
          rx={8}
          fill={owned ? `color-mix(in srgb, ${tint} 16%, var(--bg-panel))` : "var(--bg-panel)"}
          stroke={owned ? tint : "var(--border)"}
          strokeWidth={owned ? 2.5 : 1.5}
          strokeDasharray={owned ? undefined : "5 4"}
        />
        <text x={SLOT_SIZE.width / 2} y={SLOT_SIZE.height / 2} className={owned ? "base-map-slot-label" : "base-map-slot-label base-map-slot-label-locked"}>
          {label}
        </text>
      </g>
    );
  }

  return (
    <div className="base-map">
      <svg viewBox={VIEWBOX} className="base-map-svg">
        <rect
          x={WALL.x} y={WALL.y} width={WALL.width} height={WALL.height}
          rx={wall.rx} fill="var(--bg-elevated-2)"
          stroke={wall.stroke} strokeWidth={wall.width} strokeDasharray={wall.dash}
        />

        {hasWatchtower && (
          <g className="base-map-tower" transform={`translate(${WALL.x + WALL.width - 34} ${WALL.y + 10})`}>
            <rect x={0} y={14} width={24} height={30} rx={2} />
            <path d="M -3 14 L 12 -6 L 27 14 Z" />
          </g>
        )}

        {topSlots.map(renderSlot)}
        {bottomSlots.map(renderSlot)}
        {renderSlot(allianceSlot)}
      </svg>

      {selectedDef && (
        <div className="save-panel base-map-detail">
          <h3 className="section-heading">{selectedDef.name}{selectedOwned && <span className="base-upgrade-owned-tag"> · Built</span>}</h3>
          <p className="hint">{selectedDef.description}</p>
          {describeEffect(selectedDef) && <p className="base-upgrade-effect">{describeEffect(selectedDef)}</p>}
          {selectedOwned && selectedUnlockedShop && (
            <p className="base-upgrade-effect">A new shop, "{selectedUnlockedShop.shopName}", has appeared on the Shop tab.</p>
          )}
          {!selectedOwned && <p className="entity-meta">{selectedDef.cost} gp, not yet built</p>}
          <button className="btn-secondary" onClick={() => setSelectedId(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
