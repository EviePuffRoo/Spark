import { useState } from "react";
import { WelcomePanel } from "../components/WelcomePanel";
import { GeneratorPage } from "./GeneratorPage";
import { ItemForgePage } from "./ItemForgePage";
import { LocationForgePage } from "./LocationForgePage";
import { QuestForgePage } from "./QuestForgePage";
import { FactionForgePage } from "./FactionForgePage";
import { EncounterForgePage } from "./EncounterForgePage";
import { AdventureForgePage } from "./AdventureForgePage";
import { PlayerCharacterCreatePage } from "./PlayerCharacterCreatePage";
import { DungeonCreatePage } from "./DungeonCreatePage";
import { ShopCreatePage } from "./ShopCreatePage";

type CreateType = "npc" | "item" | "location" | "quest" | "faction" | "encounter" | "adventure" | "playerCharacter" | "dungeon" | "shop";

const CREATE_TYPE_LABELS: Record<CreateType, string> = {
  npc: "NPCs & Monsters",
  item: "Items",
  location: "Locations",
  quest: "Quests",
  faction: "Factions",
  encounter: "Encounter Tables",
  adventure: "Adventures",
  playerCharacter: "Player Characters",
  dungeon: "Dungeons",
  shop: "Shops",
};

export function CreatePage() {
  const [createType, setCreateType] = useState<CreateType>("npc");

  return (
    <div>
      <WelcomePanel />
      <div className="tabs create-type-tabs">
        {(Object.keys(CREATE_TYPE_LABELS) as CreateType[]).map((t) => (
          <button key={t} className={createType === t ? "active" : ""} aria-current={createType === t ? "true" : undefined} onClick={() => setCreateType(t)}>
            {CREATE_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {createType === "npc" && <GeneratorPage />}
      {createType === "item" && <ItemForgePage />}
      {createType === "location" && <LocationForgePage />}
      {createType === "quest" && <QuestForgePage />}
      {createType === "faction" && <FactionForgePage />}
      {createType === "encounter" && <EncounterForgePage />}
      {createType === "adventure" && <AdventureForgePage />}
      {createType === "playerCharacter" && <PlayerCharacterCreatePage />}
      {createType === "dungeon" && <DungeonCreatePage />}
      {createType === "shop" && <ShopCreatePage />}
    </div>
  );
}
