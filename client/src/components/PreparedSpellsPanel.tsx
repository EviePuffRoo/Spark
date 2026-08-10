import { useEffect, useMemo, useState } from "react";
import type { SpellDef } from "@spark/shared";
import { api } from "../api";

export function PreparedSpellsPanel({
  preparedSpells, className, onChange,
}: {
  preparedSpells: string[];
  className: string;
  onChange?: (preparedSpells: string[]) => void;
}) {
  const [spells, setSpells] = useState<SpellDef[]>([]);
  const [search, setSearch] = useState("");
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    api.getCompendium().then((c) => setSpells(c.spells));
  }, []);

  const spellsById = useMemo(() => new Map(spells.map((s) => [s.id, s])), [spells]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    return spells
      .filter((s) => s.classes.includes(className))
      .filter((s) => !preparedSpells.includes(s.id))
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .slice(0, 30);
  }, [spells, className, preparedSpells, search]);

  function add(id: string) {
    onChange?.([...preparedSpells, id]);
    setSearch("");
  }

  function remove(id: string) {
    onChange?.(preparedSpells.filter((s) => s !== id));
  }

  return (
    <div className="prepared-spells-panel">
      <h3 className="section-heading">Prepared Spells</h3>
      {preparedSpells.length === 0 && <p className="hint">No spells prepared.</p>}
      {preparedSpells.length > 0 && (
        <ul className="entity-list">
          {preparedSpells.map((id) => {
            const spell = spellsById.get(id);
            return (
              <li key={id} className="world-row">
                <span className="entity-name">{spell?.name ?? id}</span>
                {spell && <span className="entity-meta">{spell.level === 0 ? "Cantrip" : `Level ${spell.level}`}</span>}
                {onChange && <button className="btn-danger" onClick={() => remove(id)} aria-label={`Remove ${spell?.name ?? id}`}>Remove</button>}
              </li>
            );
          })}
        </ul>
      )}

      {onChange && (
        picking ? (
          <div className="save-panel">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${className} spells…`} />
            <ul className="entity-list">
              {results.map((s) => (
                <li key={s.id}>
                  <button className="entity-item" onClick={() => add(s.id)}>
                    <span className="entity-name">{s.name}</span>
                    <span className="entity-meta">{s.level === 0 ? "Cantrip" : `Level ${s.level}`}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button className="btn-secondary" onClick={() => setPicking(false)}>Close</button>
          </div>
        ) : (
          <button className="btn-secondary" onClick={() => setPicking(true)}>+ Prepare Spell</button>
        )
      )}
    </div>
  );
}
