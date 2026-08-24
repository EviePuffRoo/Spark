import { useEffect, useMemo, useRef, useState } from "react";
import type { SpellDef, ConditionDef, RuleDef, StatBlockTemplate, MagicItemDef } from "@spark/shared";
import { ITEM_RARITY_TIERS } from "@spark/shared";
import { api, type CompendiumData } from "../api";
import { CompendiumIcon } from "../components/icons";
import { EmptyState } from "../components/EmptyState";
import { StatBlockView } from "../components/StatBlockView";
import { ItemCardView } from "../components/ItemCardView";
import { useScrollDetailOnSelect } from "../useScrollDetailOnSelect";
import { timeAgo } from "../components/DiceRoller";

type CompendiumTab = "spells" | "conditions" | "rules" | "bestiary" | "magicItems";

const TAB_LABELS: Record<CompendiumTab, string> = {
  spells: "Spells",
  conditions: "Conditions",
  rules: "Rules",
  bestiary: "Bestiary",
  magicItems: "Magic Items",
};

// "1/8" / "1/4" / "1/2" sort and compare below their numeric CR neighbors.
function crToNumber(cr: string): number {
  if (cr.includes("/")) {
    const [num, den] = cr.split("/").map(Number);
    return num / den;
  }
  return Number(cr);
}

const LEVEL_LABELS: Record<number, string> = {
  0: "Cantrip", 1: "1st", 2: "2nd", 3: "3rd", 4: "4th",
  5: "5th", 6: "6th", 7: "7th", 8: "8th", 9: "9th",
};

function spellComponentsText(spell: SpellDef): string {
  const parts: string[] = [];
  if (spell.components.verbal) parts.push("V");
  if (spell.components.somatic) parts.push("S");
  if (spell.components.material) parts.push(spell.components.materialText ? `M (${spell.components.materialText})` : "M");
  return parts.join(", ");
}

export function CompendiumPage() {
  const [data, setData] = useState<CompendiumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [tab, setTab] = useState<CompendiumTab>("spells");
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<number | "all">("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [ruleCategoryFilter, setRuleCategoryFilter] = useState<string>("all");
  const [crFilter, setCrFilter] = useState<string>("all");
  const [rarityFilter, setRarityFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  useScrollDetailOnSelect(detailRef, selectedId);

  useEffect(() => {
    api.getCompendium()
      .then((result) => {
        setData(result.data);
        setOffline(result.offline);
        setCachedAt(result.cachedAt);
      })
      .finally(() => setLoading(false));
  }, []);

  function switchTab(next: CompendiumTab) {
    setTab(next);
    setSearch("");
    setSelectedId(null);
  }

  const spellClasses = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const s of data.spells) for (const cl of s.classes) set.add(cl);
    return Array.from(set).sort();
  }, [data]);

  const filteredSpells = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.spells.filter((s) => {
      if (levelFilter !== "all" && s.level !== levelFilter) return false;
      if (classFilter !== "all" && !s.classes.includes(classFilter)) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, levelFilter, classFilter]);

  const filteredConditions = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.conditions.filter((c) => !q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [data, search]);

  const filteredRules = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.rules.filter((r) => {
      if (ruleCategoryFilter !== "all" && r.category !== ruleCategoryFilter) return false;
      if (q && !r.name.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, ruleCategoryFilter]);

  const monsterChallengeRatings = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const m of data.monsters) set.add(m.challengeRating);
    return Array.from(set).sort((a, b) => crToNumber(a) - crToNumber(b));
  }, [data]);

  const filteredMonsters = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.monsters
      .filter((m) => {
        if (crFilter !== "all" && m.challengeRating !== crFilter) return false;
        if (q && !m.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => crToNumber(a.challengeRating) - crToNumber(b.challengeRating));
  }, [data, search, crFilter]);

  const filteredMagicItems = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.magicItems.filter((i) => {
      if (rarityFilter !== "all" && i.rarity !== rarityFilter) return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, rarityFilter]);

  const selectedSpell: SpellDef | null = tab === "spells" ? filteredSpells.find((s) => s.id === selectedId) ?? data?.spells.find((s) => s.id === selectedId) ?? null : null;
  const selectedCondition: ConditionDef | null = tab === "conditions" ? data?.conditions.find((c) => c.id === selectedId) ?? null : null;
  const selectedRule: RuleDef | null = tab === "rules" ? data?.rules.find((r) => r.id === selectedId) ?? null : null;
  const selectedMonster: StatBlockTemplate | null = tab === "bestiary" ? data?.monsters.find((m) => m.id === selectedId) ?? null : null;
  const selectedMagicItem: MagicItemDef | null = tab === "magicItems" ? data?.magicItems.find((i) => i.id === selectedId) ?? null : null;

  return (
    <div className="page roster-layout">
      <div className="panel roster-list">
        <div className="page-title">
          <CompendiumIcon className="page-title-icon" aria-hidden="true" />
          <h2>Compendium</h2>
        </div>
        <p className="hint">SRD spells, conditions, quick-reference rules, monster stat blocks, and curated magic items, searchable, no tabbing out mid-session.</p>
        {offline && (
          <p className="hint" role="status">
            You're offline — showing a saved copy from {timeAgo(cachedAt ? new Date(cachedAt).getTime() : undefined) ?? "your last visit"}.
          </p>
        )}

        <div className="tabs roster-mode-tabs">
          {(Object.keys(TAB_LABELS) as CompendiumTab[]).map((t) => (
            <button key={t} className={tab === t ? "active" : ""} aria-current={tab === t ? "true" : undefined} onClick={() => switchTab(t)}>{TAB_LABELS[t]}</button>
          ))}
        </div>

        <label className="field">
          <span>Search</span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…" />
        </label>

        {tab === "spells" && (
          <>
            <label className="field">
              <span>Level</span>
              <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value === "all" ? "all" : Number(e.target.value))}>
                <option value="all">All levels</option>
                {Object.entries(LEVEL_LABELS).map(([lvl, label]) => <option key={lvl} value={lvl}>{label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Class</span>
              <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                <option value="all">All classes</option>
                {spellClasses.map((cl) => <option key={cl} value={cl}>{cl}</option>)}
              </select>
            </label>
          </>
        )}

        {tab === "rules" && (
          <label className="field">
            <span>Category</span>
            <select value={ruleCategoryFilter} onChange={(e) => setRuleCategoryFilter(e.target.value)}>
              <option value="all">All categories</option>
              <option value="action">Actions</option>
              <option value="cover">Cover</option>
              <option value="exhaustion">Exhaustion</option>
            </select>
          </label>
        )}

        {tab === "bestiary" && (
          <label className="field">
            <span>Challenge Rating</span>
            <select value={crFilter} onChange={(e) => setCrFilter(e.target.value)}>
              <option value="all">All ratings</option>
              {monsterChallengeRatings.map((cr) => <option key={cr} value={cr}>{cr}</option>)}
            </select>
          </label>
        )}

        {tab === "magicItems" && (
          <label className="field">
            <span>Rarity</span>
            <select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)}>
              <option value="all">All rarities</option>
              {ITEM_RARITY_TIERS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        )}

        {loading && <p className="hint">Loading…</p>}

        {!loading && tab === "spells" && (
          <>
            {filteredSpells.length === 0 && <p className="hint">No spells match.</p>}
            <ul className="entity-list">
              {filteredSpells.map((s) => (
                <li key={s.id}>
                  <button className={`entity-item ${s.id === selectedId ? "active" : ""}`} aria-current={s.id === selectedId ? "true" : undefined} onClick={() => setSelectedId(s.id)}>
                    <span className="entity-name">{s.name}</span>
                    <span className="entity-meta">{LEVEL_LABELS[s.level]} · {s.school}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {!loading && tab === "conditions" && (
          <>
            {filteredConditions.length === 0 && <p className="hint">No conditions match.</p>}
            <ul className="entity-list">
              {filteredConditions.map((c) => (
                <li key={c.id}>
                  <button className={`entity-item ${c.id === selectedId ? "active" : ""}`} aria-current={c.id === selectedId ? "true" : undefined} onClick={() => setSelectedId(c.id)}>
                    <span className="entity-name">{c.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {!loading && tab === "rules" && (
          <>
            {filteredRules.length === 0 && <p className="hint">No rules match.</p>}
            <ul className="entity-list">
              {filteredRules.map((r) => (
                <li key={r.id}>
                  <button className={`entity-item ${r.id === selectedId ? "active" : ""}`} aria-current={r.id === selectedId ? "true" : undefined} onClick={() => setSelectedId(r.id)}>
                    <span className="entity-name">{r.name}</span>
                    <span className="entity-meta">{r.category}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {!loading && tab === "bestiary" && (
          <>
            {filteredMonsters.length === 0 && <p className="hint">No monsters match.</p>}
            <ul className="entity-list">
              {filteredMonsters.map((m) => (
                <li key={m.id}>
                  <button className={`entity-item ${m.id === selectedId ? "active" : ""}`} aria-current={m.id === selectedId ? "true" : undefined} onClick={() => setSelectedId(m.id)}>
                    <span className="entity-name">{m.name}</span>
                    <span className="entity-meta">CR {m.challengeRating} · {m.statBlock.creatureType}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {!loading && tab === "magicItems" && (
          <>
            {filteredMagicItems.length === 0 && <p className="hint">No magic items match.</p>}
            <ul className="entity-list">
              {filteredMagicItems.map((i) => (
                <li key={i.id}>
                  <button className={`entity-item ${i.id === selectedId ? "active" : ""}`} aria-current={i.id === selectedId ? "true" : undefined} onClick={() => setSelectedId(i.id)}>
                    <span className="entity-name">{i.name}</span>
                    <span className="entity-meta">{i.rarity} · {i.category}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="panel result-panel" ref={detailRef}>
        {!selectedSpell && !selectedCondition && !selectedRule && !selectedMonster && !selectedMagicItem && (
          <EmptyState
            icon={<CompendiumIcon />}
            heading="No entry selected"
            hint="Select a spell, condition, rule, monster, or magic item from the list to view its details."
          />
        )}

        {selectedSpell && (
          <div className="statblock">
            <h3 className="statblock-name">{selectedSpell.name}</h3>
            <p className="statblock-subtitle">{LEVEL_LABELS[selectedSpell.level]}-level {selectedSpell.school}{selectedSpell.ritual ? " (ritual)" : ""}</p>
            <ul className="spell-meta-list">
              <li><strong>Casting Time:</strong> {selectedSpell.castingTime}</li>
              <li><strong>Range:</strong> {selectedSpell.range}</li>
              <li><strong>Components:</strong> {spellComponentsText(selectedSpell)}</li>
              <li><strong>Duration:</strong> {selectedSpell.duration}{selectedSpell.concentration ? " (concentration)" : ""}</li>
              <li><strong>Classes:</strong> {selectedSpell.classes.join(", ")}</li>
            </ul>
            <p>{selectedSpell.description}</p>
          </div>
        )}

        {selectedCondition && (
          <div className="statblock">
            <h3 className="statblock-name">{selectedCondition.name}</h3>
            <p>{selectedCondition.description}</p>
          </div>
        )}

        {selectedRule && (
          <div className="statblock">
            <h3 className="statblock-name">{selectedRule.name}</h3>
            <p className="statblock-subtitle">{selectedRule.category}</p>
            <p>{selectedRule.description}</p>
          </div>
        )}

        {selectedMonster && (
          <StatBlockView
            name={selectedMonster.name}
            subtitle={`${selectedMonster.statBlock.size} ${selectedMonster.statBlock.creatureType}, ${selectedMonster.typicalAlignment}`}
            statBlock={{ ...selectedMonster.statBlock, alignment: selectedMonster.typicalAlignment }}
          />
        )}

        {selectedMagicItem && <ItemCardView item={selectedMagicItem} />}
      </div>
    </div>
  );
}
