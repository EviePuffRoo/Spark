import { useEffect, useState } from "react";
import type { PlayerCharacter, PlayerCharacterInput } from "@spark/shared";
import { api, type WorldSummary } from "../api";
import { PlayerCharacterCardView } from "../components/PlayerCharacterCardView";
import { PlayerCharacterEditor, type PlayerCharacterLivingStatePatch } from "../components/PlayerCharacterEditor";
import { LevelUpPanel } from "../components/LevelUpPanel";
import { EquipmentPanel } from "../components/EquipmentPanel";

export function MyCharacterPage({ onViewRoster }: { onViewRoster: (worldId: string) => void }) {
  const [characters, setCharacters] = useState<PlayerCharacter[]>([]);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const [restMessage, setRestMessage] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    Promise.all([
      api.listMyPlayerCharacters().then(setCharacters).catch(() => {}),
      api.listWorlds().then(setWorlds).catch(() => {}),
    ]).finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  function worldFor(pc: PlayerCharacter): WorldSummary | undefined {
    return pc.worldId ? worlds.find((w) => w.id === pc.worldId) : undefined;
  }

  async function handleSave(id: string, patch: PlayerCharacterInput & PlayerCharacterLivingStatePatch) {
    setStatus("saving");
    setError(null);
    try {
      await api.updatePlayerCharacter(id, patch);
      setEditingId(null);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    await api.deletePlayerCharacter(id);
    refresh();
  }

  async function handleRest(id: string, kind: "short" | "long") {
    const before = characters.find((c) => c.id === id)?.currentHp ?? 0;
    setStatus("saving");
    setError(null);
    setRestMessage(null);
    try {
      const updated = await api.restPlayerCharacter(id, kind);
      // A short rest otherwise heals nothing on its own — any HP gained
      // here came entirely from the world's home base comfort upgrades.
      const gained = updated.currentHp - before;
      if (kind === "short" && gained > 0) {
        setRestMessage(`${updated.name} recovered ${gained} HP from resting at the base.`);
      }
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <h2>My Character{characters.length === 1 ? "" : "s"}</h2>
        <p className="hint">Your own player characters, wherever they're assigned.</p>

        {loading && <p className="hint">Loading…</p>}
        {!loading && characters.length === 0 && (
          <p className="hint">You haven't created a character yet. Head to Create → Player Characters to add one.</p>
        )}
        {error && <p className="error">{error}</p>}
        {restMessage && <p className="success">{restMessage}</p>}

        {characters.map((pc) => {
          const world = worldFor(pc);
          return (
            <div key={pc.id} className="my-character-card">
              {editingId === pc.id ? (
                <PlayerCharacterEditor
                  value={pc}
                  equippedItems={pc.equippedItems}
                  attunedItems={pc.attunedItems}
                  currentHp={pc.currentHp}
                  deathSaves={pc.deathSaves}
                  spellSlots={pc.spellSlots}
                  preparedSpells={pc.preparedSpells}
                  classResources={pc.classResources}
                  onSave={(patch) => handleSave(pc.id, patch)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  <PlayerCharacterCardView pc={pc} />
                  <LevelUpPanel pc={pc} onUpdated={refresh} />
                  <EquipmentPanel equippedItems={pc.equippedItems} attunedItems={pc.attunedItems} baseArmorClass={pc.armorClass} />
                  <div className="button-row">
                    <button className="btn-secondary" onClick={() => setEditingId(pc.id)} disabled={status === "saving"}>Edit</button>
                    <button className="btn-secondary" onClick={() => handleRest(pc.id, "short")} disabled={status === "saving"}>Short Rest</button>
                    <button className="btn-secondary" onClick={() => handleRest(pc.id, "long")} disabled={status === "saving"}>Long Rest</button>
                    {world && <button className="btn-secondary" onClick={() => onViewRoster(world.id)}>View {world.name}</button>}
                    <button className="btn-danger" onClick={() => handleDelete(pc.id, pc.name)}>Delete</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
