import type { Item } from "@spark/shared";
import { useLocalStorage } from "../useLocalStorage";
import { WelcomePanel } from "../components/WelcomePanel";
import { GroupedTabs } from "../components/GroupedTabs";
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
import { RegionForgePage } from "./RegionForgePage";
import { SettlementForgePage } from "./SettlementForgePage";

type CreateType = "npc" | "item" | "location" | "quest" | "faction" | "encounter" | "adventure" | "playerCharacter" | "dungeon" | "shop" | "region" | "settlement";
type CreateGroup = "characters" | "world" | "story" | "tools";

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
  region: "Regions",
  settlement: "Settlements",
};

const CREATE_GROUPS: Record<CreateGroup, CreateType[]> = {
  characters: ["npc", "playerCharacter"],
  world: ["location", "region", "settlement"],
  story: ["quest", "faction", "adventure", "encounter"],
  tools: ["item", "shop", "dungeon"],
};

const CREATE_GROUP_LABELS: Record<CreateGroup, string> = {
  characters: "Characters",
  world: "World",
  story: "Story",
  tools: "Tools",
};

const CREATE_TYPE_TO_GROUP = Object.fromEntries(
  (Object.keys(CREATE_GROUPS) as CreateGroup[]).flatMap((g) => CREATE_GROUPS[g].map((t) => [t, g])),
) as Record<CreateType, CreateGroup>;

export function CreatePage({ onSendToDowntime }: { onSendToDowntime?: (item: Item, worldId: string) => void }) {
  // Persisted rather than plain useState so leaving Create (the page
  // unmounts whenever another subtab is active) and coming back doesn't
  // reset to NPCs every time — same "remember where the DM was" reasoning
  // as App.tsx's per-area subtab memory.
  const [createType, setCreateType] = useLocalStorage<CreateType>("spark-create-type", "npc");

  return (
    <div>
      <WelcomePanel />
      <GroupedTabs
        className="create-type-tabs"
        groups={CREATE_GROUPS}
        groupLabels={CREATE_GROUP_LABELS}
        itemLabels={CREATE_TYPE_LABELS}
        groupOf={(t) => CREATE_TYPE_TO_GROUP[t]}
        active={createType}
        onSelect={setCreateType}
      />

      {createType === "npc" && <GeneratorPage />}
      {createType === "item" && <ItemForgePage onSendToDowntime={onSendToDowntime} />}
      {createType === "location" && <LocationForgePage />}
      {createType === "quest" && <QuestForgePage />}
      {createType === "faction" && <FactionForgePage />}
      {createType === "encounter" && <EncounterForgePage />}
      {createType === "adventure" && <AdventureForgePage />}
      {createType === "playerCharacter" && <PlayerCharacterCreatePage />}
      {createType === "dungeon" && <DungeonCreatePage />}
      {createType === "shop" && <ShopCreatePage />}
      {createType === "region" && <RegionForgePage />}
      {createType === "settlement" && <SettlementForgePage />}
    </div>
  );
}
