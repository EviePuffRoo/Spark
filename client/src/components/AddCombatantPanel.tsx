import { useState } from "react";
import type { SearchResult, LiveCombatant, EncounterTable, SizeCategory, Item } from "@spark/shared";
import { computeEquipmentBonuses, parseStatBlockAttacks, parseSizeCategory, parseSpeedFeet, getRuleset } from "@spark/shared";

const abilityModifier = getRuleset().abilityModifier;
import { api } from "../api";
import { EntitySearchPicker } from "./EntitySearchPicker";
import { rollTableIndex } from "../rollTable";

export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

async function equipmentAcBonusFor(equippedIds: string[], attunedIds: string[]): Promise<number> {
  if (equippedIds.length === 0) return 0;
  const items = await Promise.all(equippedIds.map((id) => api.getItem(id).catch(() => null)));
  const resolved = items.filter((i): i is Item => !!i);
  return computeEquipmentBonuses(resolved, equippedIds, attunedIds).armorClass;
}

// The whole "add a combatant to the fight" flow — roster pick, encounter
// table roll, or a custom entry — self-contained apart from the one thing
// it needs from the tracker: somewhere to put the finished LiveCombatant.
export function AddCombatantPanel({ onAddCombatant }: { onAddCombatant: (c: LiveCombatant) => void }) {
  const [rosterPickType, setRosterPickType] = useState<"character" | "playerCharacter" | "encounterTable" | null>(null);
  const [pickedTable, setPickedTable] = useState<EncounterTable | null>(null);
  const [rolledTableIndex, setRolledTableIndex] = useState<number | null>(null);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customInitiative, setCustomInitiative] = useState(10);
  const [customMaxHp, setCustomMaxHp] = useState(10);
  const [customAc, setCustomAc] = useState<number | "">("");
  const [customXp, setCustomXp] = useState<number | "">("");
  const [customLevel, setCustomLevel] = useState<number | "">("");
  const [customSize, setCustomSize] = useState<SizeCategory>("medium");
  const [customSpeed, setCustomSpeed] = useState(30);
  const [customFlying, setCustomFlying] = useState(false);

  async function handlePickFromRoster(result: SearchResult) {
    const type = rosterPickType;
    if (type === "encounterTable") {
      const table = await api.getEncounterTable(result.id);
      setPickedTable(table);
      setRolledTableIndex(null);
      return;
    }
    setRosterPickType(null);
    if (type === "character") {
      const character = await api.getCharacter(result.id);
      const acBonus = await equipmentAcBonusFor(character.equippedItems, character.attunedItems);
      const attacks = parseStatBlockAttacks(character.statBlock.actions);
      const legendaryMax = character.statBlock.legendaryActions?.length ? character.statBlock.legendaryActionsPerRound ?? 3 : undefined;
      onAddCombatant({
        id: crypto.randomUUID(),
        name: character.name,
        kind: "monster",
        initiative: rollD20() + abilityModifier(character.statBlock.abilityScores.dex),
        maxHp: character.statBlock.hitPointsAverage,
        currentHp: character.statBlock.hitPointsAverage,
        hpStatus: "healthy",
        armorClass: character.statBlock.armorClass + acBonus,
        conditions: [],
        notes: "",
        hpVisible: false,
        xp: character.statBlock.xp,
        equipmentAcBonus: acBonus > 0 ? acBonus : undefined,
        attacks: attacks.length > 0 ? attacks : undefined,
        sizeCategory: parseSizeCategory(character.statBlock.size),
        speedFeet: parseSpeedFeet(character.statBlock.speed),
        legendaryActionsMax: legendaryMax,
        legendaryActionsRemaining: legendaryMax,
        legendaryActionsList: character.statBlock.legendaryActions,
        lairActionsList: character.statBlock.lairActions,
      });
    } else if (type === "playerCharacter") {
      const pc = await api.getPlayerCharacter(result.id);
      const acBonus = await equipmentAcBonusFor(pc.equippedItems, pc.attunedItems);
      onAddCombatant({
        id: crypto.randomUUID(),
        name: pc.name,
        kind: "playerCharacter",
        initiative: rollD20() + abilityModifier(pc.abilityScores.dex),
        maxHp: pc.maxHp,
        currentHp: pc.maxHp,
        hpStatus: "healthy",
        armorClass: pc.armorClass + acBonus,
        conditions: [],
        notes: "",
        hpVisible: true,
        level: pc.level,
        equipmentAcBonus: acBonus > 0 ? acBonus : undefined,
        playerCharacterId: pc.id,
        // This app doesn't track a PC's race-derived size/speed anywhere,
        // unlike NPC/monster stat blocks — Medium/30ft covers the large
        // majority of PC races and is the same default a blank stat block
        // would parse to anyway.
        sizeCategory: "medium",
        speedFeet: 30,
      });
    }
  }

  function rollOnPickedTable() {
    if (!pickedTable) return;
    setRolledTableIndex(rollTableIndex(pickedTable.entries));
  }

  function addRolledTableEntryToCombat() {
    if (!pickedTable || rolledTableIndex === null) return;
    const entry = pickedTable.entries[rolledTableIndex];
    onAddCombatant({
      id: crypto.randomUUID(),
      name: entry.description,
      kind: "custom",
      initiative: 10,
      maxHp: 10,
      currentHp: 10,
      hpStatus: "healthy",
      conditions: [],
      notes: "",
      hpVisible: false,
    });
  }

  function handleAddCustom() {
    if (!customName.trim()) return;
    onAddCombatant({
      id: crypto.randomUUID(),
      name: customName.trim(),
      kind: "custom",
      initiative: Number(customInitiative) || 0,
      maxHp: Number(customMaxHp) || 1,
      currentHp: Number(customMaxHp) || 1,
      hpStatus: "healthy",
      armorClass: customAc === "" ? undefined : Number(customAc),
      conditions: [],
      notes: "",
      hpVisible: false,
      xp: customXp === "" ? undefined : Number(customXp),
      level: customLevel === "" ? undefined : Number(customLevel),
      sizeCategory: customSize,
      speedFeet: customSpeed,
      flying: customFlying || undefined,
    });
    setCustomName("");
    setCustomInitiative(10);
    setCustomMaxHp(10);
    setCustomAc("");
    setCustomXp("");
    setCustomLevel("");
    setCustomSize("medium");
    setCustomSpeed(30);
    setCustomFlying(false);
    setAddingCustom(false);
  }

  return (
    <>
      <h3 className="section-heading">Combatants</h3>
      <div className="button-row">
        <button className="btn-secondary" aria-expanded={rosterPickType === "character"} onClick={() => { setRosterPickType(rosterPickType === "character" ? null : "character"); setAddingCustom(false); setPickedTable(null); }}>+ Add NPC/Monster</button>
        <button className="btn-secondary" aria-expanded={rosterPickType === "playerCharacter"} onClick={() => { setRosterPickType(rosterPickType === "playerCharacter" ? null : "playerCharacter"); setAddingCustom(false); setPickedTable(null); }}>+ Add PC from Roster</button>
        <button className="btn-secondary" aria-expanded={rosterPickType === "encounterTable"} onClick={() => { setRosterPickType(rosterPickType === "encounterTable" ? null : "encounterTable"); setAddingCustom(false); setPickedTable(null); }}>+ Add from Table</button>
        <button className="btn-secondary" aria-expanded={addingCustom} onClick={() => { setAddingCustom((v) => !v); setRosterPickType(null); setPickedTable(null); }}>+ Add Custom</button>
      </div>

      {rosterPickType && !pickedTable && (
        <div className="save-panel">
          <EntitySearchPicker
            type={rosterPickType}
            onSelect={handlePickFromRoster}
            placeholder={
              rosterPickType === "character" ? "Search NPCs & monsters…" :
              rosterPickType === "playerCharacter" ? "Search player characters…" :
              "Search encounter tables…"
            }
          />
        </div>
      )}

      {rosterPickType === "encounterTable" && pickedTable && (
        <div className="save-panel">
          <h3 className="section-heading">{pickedTable.name}</h3>
          <button className="btn-secondary" onClick={rollOnPickedTable}>Roll on this Table</button>
          {rolledTableIndex !== null && (
            <>
              <p className="encounter-roll-result" role="status">
                Rolled <strong>{pickedTable.entries[rolledTableIndex].roll}</strong>: {pickedTable.entries[rolledTableIndex].description}
              </p>
              <button className="btn-primary" onClick={addRolledTableEntryToCombat}>Add to Combat</button>
            </>
          )}
          <button className="btn-secondary" onClick={() => { setPickedTable(null); setRolledTableIndex(null); }}>Choose a different table</button>
        </div>
      )}

      {addingCustom && (
        <div className="save-panel">
          <label className="field">
            <span>Name</span>
            <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. Aria (PC)" />
          </label>
          <label className="field">
            <span>Initiative</span>
            <input type="number" value={customInitiative} onChange={(e) => setCustomInitiative(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>Max HP</span>
            <input type="number" value={customMaxHp} onChange={(e) => setCustomMaxHp(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>AC (optional)</span>
            <input type="number" value={customAc} onChange={(e) => setCustomAc(e.target.value === "" ? "" : Number(e.target.value))} />
          </label>
          <label className="field">
            <span>XP value (optional, for difficulty calc)</span>
            <input type="number" value={customXp} onChange={(e) => setCustomXp(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 450 for a CR 8 monster" />
          </label>
          <label className="field">
            <span>Level (optional, if this is a PC)</span>
            <input type="number" value={customLevel} onChange={(e) => setCustomLevel(e.target.value === "" ? "" : Number(e.target.value))} />
          </label>
          <label className="field">
            <span>Size (for the battle grid)</span>
            <select value={customSize} onChange={(e) => setCustomSize(e.target.value as SizeCategory)}>
              <option value="tiny">Tiny</option>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="huge">Huge</option>
              <option value="gargantuan">Gargantuan</option>
            </select>
          </label>
          <label className="field">
            <span>Speed, ft (for the battle grid)</span>
            <input type="number" min={0} value={customSpeed} onChange={(e) => setCustomSpeed(Number(e.target.value) || 0)} />
          </label>
          <label className="condition-toggle">
            <input type="checkbox" checked={customFlying} onChange={(e) => setCustomFlying(e.target.checked)} />
            Flying
          </label>
          <button className="btn-primary" onClick={handleAddCustom}>Add Combatant</button>
        </div>
      )}
    </>
  );
}
