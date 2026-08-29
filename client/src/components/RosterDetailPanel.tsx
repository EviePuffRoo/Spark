import type { Character, Item, Location, QuestHook, Faction, EncounterTable, SessionNote, Adventure, PlayerCharacter, ZoneMapTemplate, Dungeon, DungeonRoomRect, Shop, Region, Settlement, HouseRules } from "@spark/shared";
import { api } from "../api";
import { StatBlockView } from "./StatBlockView";
import { BackstoryView } from "./BackstoryView";
import { ItemCardView } from "./ItemCardView";
import { LocationCardView } from "./LocationCardView";
import { QuestHookCardView } from "./QuestHookCardView";
import { FactionCardView } from "./FactionCardView";
import { NpcDispositionView } from "./NpcDispositionView";
import { EncounterTableCardView } from "./EncounterTableCardView";
import { ZoneMapTemplateCardView } from "./ZoneMapTemplateCardView";
import { DungeonCardView } from "./DungeonCardView";
import { DungeonEditor } from "./DungeonEditor";
import { DungeonMapView } from "./DungeonMapView";
import { ShopCardView } from "./ShopCardView";
import { ShopEditor } from "./ShopEditor";
import { SessionNoteCardView } from "./SessionNoteCardView";
import { EquipmentPanel } from "./EquipmentPanel";
import { AdventureCardView } from "./AdventureCardView";
import { PlayerCharacterCardView } from "./PlayerCharacterCardView";
import { LevelUpPanel } from "./LevelUpPanel";
import { CharacterEditor } from "./CharacterEditor";
import { ItemEditor } from "./ItemEditor";
import { LocationEditor } from "./LocationEditor";
import { QuestEditor } from "./QuestEditor";
import { FactionEditor } from "./FactionEditor";
import { EncounterTableEditor } from "./EncounterTableEditor";
import { AdventureEditor } from "./AdventureEditor";
import { PlayerCharacterEditor } from "./PlayerCharacterEditor";
import { RegionCardView } from "./RegionCardView";
import { RegionEditor } from "./RegionEditor";
import { SettlementCardView } from "./SettlementCardView";
import { SettlementEditor } from "./SettlementEditor";

// The 14-entity-type "show a CardView, or an Editor while editing" dispatch
// for whichever roster entry is selected — every branch is independent of
// the others (each fires on its own `selectedX` prop), so this is a pure
// render fork with no state of its own. The surrounding action buttons and
// the shared "Roster Details" save panel stay in RosterPage: those interleave
// mode-specific conditionals with RosterPage's per-mode update/delete/save
// state in ways that aren't safe to split out mechanically.
export function RosterDetailPanel({
  editingContent, setEditingContent, selectedDisplayName, hasSelected, canEditSelected, refresh,
  selectedCharacter, selectedItem, selectedLocation, selectedQuest, selectedFaction, selectedEncounter,
  selectedNote, selectedAdventure, selectedPlayerCharacter, selectedPlayerCharacterHouseRules, selectedZoneMapTemplate, selectedDungeon,
  selectedShop, selectedRegion, selectedSettlement,
  showDungeonMap, onUpdateDungeonRoomRect, onAutoArrangeDungeon,
}: {
  editingContent: boolean;
  setEditingContent: (v: boolean) => void;
  selectedDisplayName: string;
  hasSelected: boolean;
  canEditSelected: boolean;
  refresh: () => void;
  selectedCharacter: Character | null;
  selectedItem: Item | null;
  selectedLocation: Location | null;
  selectedQuest: QuestHook | null;
  selectedFaction: Faction | null;
  selectedEncounter: EncounterTable | null;
  selectedNote: SessionNote | null;
  selectedAdventure: Adventure | null;
  selectedPlayerCharacter: PlayerCharacter | null;
  selectedPlayerCharacterHouseRules?: HouseRules;
  selectedZoneMapTemplate: ZoneMapTemplate | null;
  selectedDungeon: Dungeon | null;
  selectedShop: Shop | null;
  selectedRegion: Region | null;
  selectedSettlement: Settlement | null;
  showDungeonMap: boolean;
  onUpdateDungeonRoomRect: (roomId: string, rect: DungeonRoomRect) => Promise<void>;
  onAutoArrangeDungeon: () => Promise<void>;
}) {
  return (
    <>
      {hasSelected && editingContent && <h2>Editing {selectedDisplayName}</h2>}

      {selectedCharacter && !editingContent && (
        <>
          <StatBlockView
            name={selectedCharacter.name}
            subtitle={`${selectedCharacter.statBlock.size} ${selectedCharacter.statBlock.creatureType}, ${selectedCharacter.statBlock.alignment}${selectedCharacter.race ? ` · ${selectedCharacter.race}` : ""}${selectedCharacter.background ? `, ${selectedCharacter.background}` : ""}`}
            statBlock={selectedCharacter.statBlock}
          />
          <BackstoryView backstory={selectedCharacter.backstory} />
          <EquipmentPanel
            equippedItems={selectedCharacter.equippedItems}
            attunedItems={selectedCharacter.attunedItems}
            baseArmorClass={selectedCharacter.statBlock.armorClass}
          />
          {selectedCharacter.kind === "npc" && (
            <NpcDispositionView
              characterId={selectedCharacter.id}
              disposition={selectedCharacter.disposition}
              perPcDisposition={selectedCharacter.perPcDisposition}
              factionId={selectedCharacter.factionId}
              canEdit={canEditSelected}
              onChanged={refresh}
              onLinkFaction={async (factionId) => {
                await api.updateCharacter(selectedCharacter.id, { factionId });
                refresh();
              }}
            />
          )}
        </>
      )}
      {selectedCharacter && editingContent && (
        <CharacterEditor
          character={selectedCharacter}
          onSave={async (patch) => { await api.updateCharacter(selectedCharacter.id, patch); setEditingContent(false); refresh(); }}
          onCancel={() => setEditingContent(false)}
        />
      )}

      {selectedItem && !editingContent && <ItemCardView item={selectedItem} />}
      {selectedItem && editingContent && (
        <ItemEditor
          value={selectedItem}
          onSave={async (patch) => { await api.updateItem(selectedItem.id, patch); setEditingContent(false); refresh(); }}
          onCancel={() => setEditingContent(false)}
        />
      )}

      {selectedLocation && !editingContent && <LocationCardView location={selectedLocation} />}
      {selectedLocation && editingContent && (
        <LocationEditor
          value={selectedLocation}
          onSave={async (patch) => { await api.updateLocation(selectedLocation.id, patch); setEditingContent(false); refresh(); }}
          onCancel={() => setEditingContent(false)}
        />
      )}

      {selectedQuest && !editingContent && <QuestHookCardView quest={selectedQuest} />}
      {selectedQuest && editingContent && (
        <QuestEditor
          value={selectedQuest}
          onSave={async (patch) => { await api.updateQuest(selectedQuest.id, patch); setEditingContent(false); refresh(); }}
          onCancel={() => setEditingContent(false)}
        />
      )}

      {selectedFaction && !editingContent && (
        <FactionCardView
          faction={selectedFaction}
          canEdit={canEditSelected}
          onChanged={refresh}
        />
      )}
      {selectedFaction && editingContent && (
        <FactionEditor
          value={selectedFaction}
          onSave={async (patch) => { await api.updateFaction(selectedFaction.id, patch); setEditingContent(false); refresh(); }}
          onCancel={() => setEditingContent(false)}
        />
      )}

      {selectedEncounter && !editingContent && <EncounterTableCardView table={selectedEncounter} />}
      {selectedEncounter && editingContent && (
        <EncounterTableEditor
          value={selectedEncounter}
          onSave={async (patch) => { await api.updateEncounterTable(selectedEncounter.id, patch); setEditingContent(false); refresh(); }}
          onCancel={() => setEditingContent(false)}
        />
      )}

      {selectedNote && (
        <>
          <SessionNoteCardView note={selectedNote} />
          <p className="hint">Edit this note from the Notes tab.</p>
        </>
      )}

      {selectedAdventure && !editingContent && <AdventureCardView adventure={selectedAdventure} />}
      {selectedAdventure && editingContent && (
        <AdventureEditor
          value={selectedAdventure}
          onSave={async (patch) => { await api.updateAdventure(selectedAdventure.id, patch); setEditingContent(false); refresh(); }}
          onCancel={() => setEditingContent(false)}
        />
      )}

      {selectedPlayerCharacter && !editingContent && (
        <>
          <PlayerCharacterCardView pc={selectedPlayerCharacter} />
          <LevelUpPanel pc={selectedPlayerCharacter} onUpdated={refresh} />
          <EquipmentPanel
            equippedItems={selectedPlayerCharacter.equippedItems}
            attunedItems={selectedPlayerCharacter.attunedItems}
            baseArmorClass={selectedPlayerCharacter.armorClass}
            strengthScore={selectedPlayerCharacter.abilityScores.str}
            houseRules={selectedPlayerCharacterHouseRules}
          />
        </>
      )}
      {selectedPlayerCharacter && editingContent && (
        <PlayerCharacterEditor
          value={selectedPlayerCharacter}
          equippedItems={selectedPlayerCharacter.equippedItems}
          attunedItems={selectedPlayerCharacter.attunedItems}
          currentHp={selectedPlayerCharacter.currentHp}
          deathSaves={selectedPlayerCharacter.deathSaves}
          spellSlots={selectedPlayerCharacter.spellSlots}
          preparedSpells={selectedPlayerCharacter.preparedSpells}
          classResources={selectedPlayerCharacter.classResources}
          houseRules={selectedPlayerCharacterHouseRules}
          onSave={async (patch) => { await api.updatePlayerCharacter(selectedPlayerCharacter.id, patch); setEditingContent(false); refresh(); }}
          onCancel={() => setEditingContent(false)}
        />
      )}

      {selectedZoneMapTemplate && (
        <>
          <ZoneMapTemplateCardView template={selectedZoneMapTemplate} />
          <p className="hint">Edit this template by loading it into a Zone Map in Combat and saving over it.</p>
        </>
      )}

      {selectedDungeon && !editingContent && <DungeonCardView dungeon={selectedDungeon} />}
      {selectedDungeon && !editingContent && showDungeonMap && (
        <DungeonMapView
          dungeon={selectedDungeon}
          canEdit={canEditSelected}
          onUpdateRoomRect={onUpdateDungeonRoomRect}
          onAutoArrange={canEditSelected ? onAutoArrangeDungeon : undefined}
        />
      )}
      {selectedDungeon && editingContent && (
        <DungeonEditor
          value={selectedDungeon}
          onSave={async (patch) => { await api.updateDungeon(selectedDungeon.id, patch); setEditingContent(false); refresh(); }}
          onCancel={() => setEditingContent(false)}
          saveLabel="Save Changes"
        />
      )}

      {selectedShop && !editingContent && <ShopCardView shop={selectedShop} />}
      {selectedShop && editingContent && (
        <ShopEditor
          value={selectedShop}
          onSave={async (patch) => { await api.updateShop(selectedShop.id, patch); setEditingContent(false); refresh(); }}
          onCancel={() => setEditingContent(false)}
          saveLabel="Save Changes"
        />
      )}

      {selectedRegion && !editingContent && <RegionCardView region={selectedRegion} />}
      {selectedRegion && editingContent && (
        <RegionEditor
          value={selectedRegion}
          onSave={async (patch) => { await api.updateRegion(selectedRegion.id, patch); setEditingContent(false); refresh(); }}
          onCancel={() => setEditingContent(false)}
          saveLabel="Save Changes"
        />
      )}

      {selectedSettlement && !editingContent && <SettlementCardView settlement={selectedSettlement} />}
      {selectedSettlement && editingContent && (
        <SettlementEditor
          value={selectedSettlement}
          onSave={async (patch) => { await api.updateSettlement(selectedSettlement.id, patch); setEditingContent(false); refresh(); }}
          onCancel={() => setEditingContent(false)}
          saveLabel="Save Changes"
        />
      )}
    </>
  );
}
