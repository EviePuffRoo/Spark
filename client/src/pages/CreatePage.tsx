import { useState } from "react";
import { GeneratorPage } from "./GeneratorPage";
import { ItemForgePage } from "./ItemForgePage";
import { LocationForgePage } from "./LocationForgePage";
import { QuestForgePage } from "./QuestForgePage";
import { FactionForgePage } from "./FactionForgePage";
import { EncounterForgePage } from "./EncounterForgePage";

type CreateType = "npc" | "item" | "location" | "quest" | "faction" | "encounter";

const CREATE_TYPE_LABELS: Record<CreateType, string> = {
  npc: "NPCs & Monsters",
  item: "Items",
  location: "Locations",
  quest: "Quests",
  faction: "Factions",
  encounter: "Encounter Tables",
};

export function CreatePage() {
  const [createType, setCreateType] = useState<CreateType>("npc");

  return (
    <div>
      <div className="tabs create-type-tabs">
        {(Object.keys(CREATE_TYPE_LABELS) as CreateType[]).map((t) => (
          <button key={t} className={createType === t ? "active" : ""} onClick={() => setCreateType(t)}>
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
    </div>
  );
}
